-- ==============================================================================
-- Migration: 20261023000002_add_parent_and_child_super_admin_roles.sql
-- Description:
-- 1. Expands admin_role constraint to include 'parent_super_admin', 'child_super_admin', and 'admin'.
-- 2. Purges legacy subroles ('content_admin', 'operations_admin', 'moderator').
-- 3. Sets Ramanan (ajayramanan17@gmail.com) as the canonical Parent Super Admin.
-- 4. Updates public.has_admin_permission() so Parent Super Admin has all permissions
--    (including manage_roles), Child Super Admin has all operational permissions
--    except manage_roles, and Admin has standard curriculum/cohort operations.
-- 5. Updates public.admin_update_user_role() RPC to enforce that only Parent Super Admin
--    can register/assign roles.
-- ==============================================================================

-- 0. Upgrade fn_protect_profile_privilege_fields trigger FIRST so updates are not overridden
create or replace function public.fn_protect_profile_privilege_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_parent_admin_count int;
begin
  -- Service role / migration execution without auth.uid()
  if v_caller_id is null then
    if new.role != 'admin' then
      new.admin_role := null;
    elsif new.admin_role is null or new.admin_role not in ('parent_super_admin', 'child_super_admin', 'super_admin', 'admin') then
      if new.email = 'ajayramanan17@gmail.com' or new.id = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b' then
        new.admin_role := 'parent_super_admin';
      else
        new.admin_role := 'child_super_admin';
      end if;
    end if;
    return new;
  end if;

  -- INSERT Logic: Prevent self-registration with elevated roles
  if tg_op = 'INSERT' then
    if not public.has_admin_permission('manage_roles') then
      new.id := v_caller_id;
      new.role := 'student';
      new.admin_role := null;
      new.status := 'active';
    else
      if new.role != 'admin' then
        new.admin_role := null;
      elsif new.admin_role not in ('parent_super_admin', 'child_super_admin', 'super_admin', 'admin') then
        new.admin_role := 'child_super_admin';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE Logic: Prevent unauthorized role or status modification
  if tg_op = 'UPDATE' then
    -- User attempting to modify their own profile
    if v_caller_id = old.id then
      if new.role is distinct from old.role then
        raise exception 'Unauthorized: Users cannot alter their own system role.'
          using errcode = '42501';
      end if;

      if new.admin_role is distinct from old.admin_role then
        raise exception 'Unauthorized: Users cannot alter their own administrative sub-role.'
          using errcode = '42501';
      end if;

      if new.status is distinct from old.status then
        raise exception 'Unauthorized: Users cannot alter their own account status.'
          using errcode = '42501';
      end if;
    end if;

    -- Caller modifying role or admin_role of any user
    if (new.role is distinct from old.role) or (new.admin_role is distinct from old.admin_role) then
      if not public.has_admin_permission('manage_roles') then
        raise exception 'Unauthorized: Only Parent Super Admin can modify user roles or administrative sub-roles.'
          using errcode = '42501';
      end if;

      -- Enforce role consistency
      if new.role != 'admin' then
        new.admin_role := null;
      elsif new.admin_role not in ('parent_super_admin', 'child_super_admin', 'super_admin', 'admin') then
        new.admin_role := 'child_super_admin';
      end if;

      -- Protect against demoting the root Parent Super Admin
      if old.email = 'ajayramanan17@gmail.com' and (new.role != 'admin' or new.admin_role not in ('parent_super_admin', 'super_admin')) then
        raise exception 'Cannot demote or revoke the root Parent Super Admin.'
          using errcode = 'P0001';
      end if;
    end if;

    -- Caller modifying user status
    if new.status is distinct from old.status then
      if not (public.has_admin_permission('manage_user_status') or public.has_admin_permission('manage_roles')) then
        raise exception 'Unauthorized: Insufficient permissions to modify account status.'
          using errcode = '42501';
      end if;

      -- Prevent deactivating the root Parent Super Admin
      if old.email = 'ajayramanan17@gmail.com' and new.status != 'active' then
        raise exception 'Cannot deactivate the root Parent Super Admin.'
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- 1. Sanitize all rows before applying check constraint
update public.profiles
set role = 'student'
where role is null or role not in ('student', 'mentor', 'admin');

update public.profiles
set admin_role = null, updated_at = now()
where role is distinct from 'admin' or role in ('student', 'mentor');

update public.profiles
set admin_role = case
  when email = 'ajayramanan17@gmail.com' or id = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b' then 'parent_super_admin'
  else 'child_super_admin'
end, updated_at = now()
where role = 'admin' and (admin_role is null or admin_role not in ('parent_super_admin', 'child_super_admin', 'super_admin', 'admin'));

-- 2. Expand admin_role check constraint
alter table public.profiles
  drop constraint if exists profiles_admin_role_check;

alter table public.profiles
  add constraint profiles_admin_role_check
  check (
    admin_role is null
    or admin_role in ('parent_super_admin', 'child_super_admin', 'super_admin', 'admin')
  );

-- 3. Ensure Ramanan is Parent Super Admin
update public.profiles
set 
  role = 'admin',
  admin_role = 'parent_super_admin',
  status = 'active',
  updated_at = now()
where email = 'ajayramanan17@gmail.com' or id = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b';

-- 4. Update public.has_admin_permission helper
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

  if not found or coalesce(v_status, 'active') != 'active' then
    return false;
  end if;

  -- User must be an admin or have a valid admin subrole
  if v_role != 'admin' and (v_admin_role is null or v_admin_role not in ('parent_super_admin', 'child_super_admin', 'super_admin', 'admin')) then
    return false;
  end if;

  -- Default to parent_super_admin if admin_role is unspecified
  v_admin_role := coalesce(v_admin_role, 'parent_super_admin');

  -- Parent Super Admin holds sovereignty over ALL permissions (including manage_roles)
  if v_admin_role in ('parent_super_admin', 'super_admin') then
    return true;
  end if;

  -- Child Super Admin holds all operational and platform permissions, EXCEPT manage_roles
  if v_admin_role = 'child_super_admin' and p_permission != 'manage_roles' then
    return true;
  end if;

  -- Standard Admin permissions
  if (v_admin_role = 'admin' or v_role = 'admin') and p_permission in (
    'manage_cohorts',
    'manage_curriculum',
    'publish_content',
    'manage_enrollments',
    'broadcast_announcements',
    'schedule_sessions',
    'moderate_community',
    'view_insights'
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- 5. Update public.admin_update_user_role RPC
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
  v_caller_profile record;
  v_target_profile record;
  v_updated record;
begin
  -- 1. Caller verification: Only Parent Super Admin can modify roles
  select id, email, role, admin_role, status
  into v_caller_profile
  from public.profiles
  where id = auth.uid();

  if not found or coalesce(v_caller_profile.status, 'active') != 'active' or 
     coalesce(v_caller_profile.admin_role, 'parent_super_admin') not in ('parent_super_admin', 'super_admin') then
    raise exception 'Unauthorized: Only Parent Super Admin can add or modify roles.'
      using errcode = '42501';
  end if;

  -- 2. Validate target role
  if p_new_role not in ('student', 'mentor', 'admin') then
    raise exception 'Invalid role: % is not a recognized system role.', p_new_role
      using errcode = '22000';
  end if;

  -- 3. Validate target admin subrole
  if p_new_admin_role is not null and p_new_admin_role not in ('parent_super_admin', 'child_super_admin', 'super_admin', 'admin') then
    raise exception 'Invalid admin_role: % is not a recognized admin role.', p_new_admin_role
      using errcode = '22000';
  end if;

  -- 4. Target verification
  select id, email, role, admin_role, status
  into v_target_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'User profile % not found.', p_user_id
      using errcode = 'P0002';
  end if;

  -- 5. Protection: Prevent demoting Parent Super Admin (Ramanan)
  if v_target_profile.email = 'ajayramanan17@gmail.com' and (p_new_role != 'admin' or coalesce(p_new_admin_role, 'parent_super_admin') not in ('parent_super_admin', 'super_admin')) then
    raise exception 'Cannot demote or revoke the root Parent Super Admin.'
      using errcode = 'P0001';
  end if;

  -- 6. Apply update
  update public.profiles
  set
    role = p_new_role,
    admin_role = case when p_new_role = 'admin' then coalesce(p_new_admin_role, admin_role, 'admin') else null end,
    updated_at = now()
  where id = p_user_id
  returning id, full_name, email, role, admin_role, status, updated_at
  into v_updated;

  -- 7. Audit log
  perform public.log_audit_event(
    'user.role_changed',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'previous_role', v_target_profile.role,
      'previous_admin_role', v_target_profile.admin_role,
      'new_role', p_new_role,
      'new_admin_role', case when p_new_role = 'admin' then coalesce(p_new_admin_role, v_target_profile.admin_role, 'admin') else null end,
      'user_email', v_target_profile.email,
      'updated_by', v_caller_profile.email
    )
  );

  return to_jsonb(v_updated);
end;
$$;
