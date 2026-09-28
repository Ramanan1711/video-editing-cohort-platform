-- ==============================================================================
-- Migration: 20260928000002_enforce_admin_subroles_and_protect_roles.sql
-- Description: 
-- 1. Prevents self-update policy from leaving admin_role mutable.
-- 2. Implements SQL-level granular subrole permission verification (has_admin_permission).
-- 3. Enforces subroles across RPCs (admin_update_user_role, admin_update_user_status)
--    and table policies (audit_logs, enrollments, lesson_resources, profiles).
-- 4. Installs bulletproof BEFORE UPDATE trigger on profiles protecting privilege fields.
-- ==============================================================================

-- 1. Granular Administrative Permission Evaluation Helper
create or replace function public.has_admin_permission(p_permission text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role text;
  v_admin_role text;
  v_status text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select role, admin_role, status
  into v_role, v_admin_role, v_status
  from public.profiles
  where id = auth.uid();

  if not found or v_role != 'admin' or coalesce(v_status, 'active') != 'active' then
    return false;
  end if;

  -- Default to super_admin if admin_role is unspecified
  v_admin_role := coalesce(v_admin_role, 'super_admin');

  -- Super Admin holds sovereignty over all permissions
  if v_admin_role = 'super_admin' then
    return true;
  end if;

  -- Content Admin permissions
  if v_admin_role = 'content_admin' and p_permission in (
    'manage_cohorts',
    'manage_curriculum',
    'publish_content',
    'view_insights'
  ) then
    return true;
  end if;

  -- Operations Admin permissions
  if v_admin_role = 'operations_admin' and p_permission in (
    'manage_cohorts',
    'manage_enrollments',
    'broadcast_announcements',
    'schedule_sessions',
    'view_insights'
  ) then
    return true;
  end if;

  -- Moderator permissions
  if v_admin_role = 'moderator' and p_permission in (
    'moderate_community',
    'broadcast_announcements',
    'view_insights'
  ) then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.has_admin_permission(text) to authenticated, anon;

-- 2. Protect Privilege Fields on Profiles via BEFORE UPDATE Trigger
create or replace function public.fn_protect_profile_privilege_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_super_admin_count int;
  v_admin_count int;
begin
  -- If trigger executed by internal migrations or service role without auth.uid(), bypass
  if v_caller_id is null then
    return new;
  end if;

  -- Case A: User attempting to modify their own profile
  if v_caller_id = old.id then
    -- Cannot escalate or alter role
    if new.role is distinct from old.role then
      raise exception 'Unauthorized: Users cannot alter their own system role.'
        using errcode = '42501';
    end if;

    -- Cannot escalate or alter admin_role
    if new.admin_role is distinct from old.admin_role then
      raise exception 'Unauthorized: Users cannot alter their own administrative sub-role.'
        using errcode = '42501';
    end if;

    -- Cannot alter their own account status
    if new.status is distinct from old.status then
      raise exception 'Unauthorized: Users cannot alter their own account status.'
        using errcode = '42501';
    end if;
  end if;

  -- Case B: Caller is modifying role or admin_role of any user (including other admins)
  if (new.role is distinct from old.role) or (new.admin_role is distinct from old.admin_role) then
    if not public.has_admin_permission('manage_roles') then
      raise exception 'Unauthorized: Only Super Administrators can modify user roles or administrative sub-roles.'
        using errcode = '42501';
    end if;

    -- Protect against demoting the last active super_admin
    if old.role = 'admin' and coalesce(old.admin_role, 'super_admin') = 'super_admin' and
       (new.role != 'admin' or coalesce(new.admin_role, 'super_admin') != 'super_admin') then
      select count(*) into v_super_admin_count
      from public.profiles
      where role = 'admin' and coalesce(admin_role, 'super_admin') = 'super_admin' and coalesce(status, 'active') = 'active';

      if v_super_admin_count <= 1 then
        raise exception 'Safety block: Cannot demote or revoke the last remaining active Super Admin.'
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- Case C: Caller is modifying user status
  if new.status is distinct from old.status then
    if not (public.has_admin_permission('manage_user_status') or public.has_admin_permission('manage_roles')) then
      raise exception 'Unauthorized: Insufficient permissions to modify account status.'
        using errcode = '42501';
    end if;

    -- Prevent suspending the last active administrator
    if old.role = 'admin' and new.status != 'active' then
      select count(*) into v_admin_count
      from public.profiles
      where role = 'admin' and coalesce(status, 'active') = 'active';

      if v_admin_count <= 1 then
        raise exception 'Safety block: Cannot deactivate the last remaining active administrator.'
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privilege_fields on public.profiles;
create trigger trg_protect_profile_privilege_fields
  before update on public.profiles
  for each row
  execute function public.fn_protect_profile_privilege_fields();

-- 3. RLS Lockdown on Profiles Table
alter table public.profiles enable row level security;

-- Self-update policy: explicitly lock down admin_role, role, and status
drop policy if exists "Users can update own display name" on public.profiles;
create policy "Users can update own display name"
on public.profiles for update
to authenticated
using (id = auth.uid() and public.is_active_user())
with check (
  id = auth.uid()
  and role = (select p.role from public.profiles p where p.id = auth.uid())
  and coalesce(status, 'active') = (select coalesce(p.status, 'active') from public.profiles p where p.id = auth.uid())
  and admin_role is not distinct from (select p.admin_role from public.profiles p where p.id = auth.uid())
);

-- Admin profile update policy: only admins with role or status permissions
drop policy if exists "Admins can update user profiles" on public.profiles;
create policy "Admins can update user profiles"
on public.profiles for update
to authenticated
using (
  public.has_admin_permission('manage_roles')
  or public.has_admin_permission('manage_user_status')
)
with check (
  public.has_admin_permission('manage_roles')
  or public.has_admin_permission('manage_user_status')
);

-- 4. Update Server-Side Role RPCs to Enforce Subroles
create or replace function public.admin_update_user_role(
  p_user_id uuid,
  p_new_role text,
  p_new_admin_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_profile record;
  v_super_admin_count integer;
  v_updated record;
begin
  -- 1. Enforce manage_roles administrative subrole permission (only super_admin)
  if not (public.has_admin_permission('manage_roles') and public.is_active_user()) then
    raise exception 'Unauthorized: Only Super Administrators can modify roles or admin sub-roles.'
      using errcode = '42501';
  end if;

  -- 2. Validate target role
  if p_new_role not in ('student', 'mentor', 'admin') then
    raise exception 'Invalid role: % is not a recognized system role.', p_new_role
      using errcode = '22000';
  end if;

  -- 3. Validate admin sub-role if specified
  if p_new_admin_role is not null and p_new_admin_role not in ('super_admin', 'content_admin', 'operations_admin', 'moderator') then
    raise exception 'Invalid admin_role: % is not a recognized admin role.', p_new_admin_role
      using errcode = '22000';
  end if;

  -- 4. Load target user
  select id, email, role, admin_role, status
  into v_target_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'User profile % not found.', p_user_id
      using errcode = 'P0002';
  end if;

  -- 5. Protection: Prevent demoting the last super_admin
  if coalesce(v_target_profile.admin_role, 'super_admin') = 'super_admin' and v_target_profile.role = 'admin' and
     (p_new_role != 'admin' or coalesce(p_new_admin_role, 'super_admin') != 'super_admin') then
    select count(*)
    into v_super_admin_count
    from public.profiles
    where role = 'admin' and coalesce(admin_role, 'super_admin') = 'super_admin' and coalesce(status, 'active') = 'active';

    if v_super_admin_count <= 1 then
      raise exception 'Cannot demote the last remaining active Super Admin.'
        using errcode = 'P0001';
    end if;
  end if;

  -- 6. Apply update
  update public.profiles
  set
    role = p_new_role,
    admin_role = case when p_new_role = 'admin' then coalesce(p_new_admin_role, admin_role, 'super_admin') else null end,
    updated_at = now()
  where id = p_user_id
  returning id, full_name, email, role, admin_role, status, updated_at
  into v_updated;

  -- 7. Audit logging
  perform public.log_audit_event(
    'user.role_changed',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'previous_role', v_target_profile.role,
      'previous_admin_role', v_target_profile.admin_role,
      'new_role', v_updated.role,
      'new_admin_role', v_updated.admin_role,
      'user_email', v_updated.email
    )
  );

  return to_jsonb(v_updated);
end;
$$;

create or replace function public.admin_update_user_status(
  p_user_id uuid,
  p_new_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_profile record;
  v_admin_count integer;
  v_updated record;
begin
  -- 1. Enforce manage_user_status administrative subrole permission
  if not (public.has_admin_permission('manage_user_status') and public.is_active_user()) then
    raise exception 'Unauthorized: Insufficient permissions to modify account status.'
      using errcode = '42501';
  end if;

  -- 2. Validate status
  if p_new_status not in ('active', 'suspended', 'inactive') then
    raise exception 'Invalid status: % is not a recognized status.', p_new_status
      using errcode = '22000';
  end if;

  -- 3. Load target profile
  select id, email, role, admin_role, status
  into v_target_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'User profile % not found.', p_user_id
      using errcode = 'P0002';
  end if;

  -- 4. Protection: Cannot deactivate last admin
  if v_target_profile.role = 'admin' and p_new_status != 'active' then
    select count(*)
    into v_admin_count
    from public.profiles
    where role = 'admin' and coalesce(status, 'active') = 'active';

    if v_admin_count <= 1 then
      raise exception 'Safety block: Cannot deactivate the last remaining active administrator.'
        using errcode = 'P0001';
    end if;
  end if;

  -- 5. Apply update
  update public.profiles
  set
    status = p_new_status,
    updated_at = now()
  where id = p_user_id
  returning id, full_name, email, role, admin_role, status, updated_at
  into v_updated;

  -- 6. Audit logging
  perform public.log_audit_event(
    'user.status_changed',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'previous_status', v_target_profile.status,
      'new_status', p_new_status,
      'user_email', v_updated.email
    )
  );

  return to_jsonb(v_updated);
end;
$$;

-- 5. Enforce Subroles on Audit Logs (Only Super Admin can view security audit logs)
drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
on public.audit_logs for select
to authenticated
using (public.has_admin_permission('view_audit_logs'));

-- 6. Enforce Subroles on Enrollments (Only Super Admin & Operations Admin can manage enrollments)
drop policy if exists "Admins have full management on enrollments" on public.enrollments;
create policy "Admins have full management on enrollments"
on public.enrollments for all
to authenticated
using (public.has_admin_permission('manage_enrollments'))
with check (public.has_admin_permission('manage_enrollments'));

-- 7. Enforce Subroles on Lesson Resources (Only Super Admin & Content Admin can manage curriculum)
drop policy if exists "Admins can manage lesson resources" on public.lesson_resources;
create policy "Admins can manage lesson resources"
on public.lesson_resources for all
to authenticated
using (public.has_admin_permission('manage_curriculum'))
with check (public.has_admin_permission('manage_curriculum'));

