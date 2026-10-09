-- ==============================================================================
-- Migration: 20261009000001_sync_admin_subroles_and_harden_rls_helpers.sql
-- Description: Self-Healing Profile Roles, Hardened Authorization Helpers, and Public Profile View:
--              1. Re-aligns user profiles: Any user with admin_role set to a valid admin subrole
--                 ('super_admin', 'content_admin', 'operations_admin', 'moderator') is normalized to role = 'admin'.
--              2. Hardens public.is_admin(), public.is_mentor_or_admin(), and public.has_admin_permission()
--                 to recognize administrative subroles even if primary role is momentarily out of sync.
--              3. Enhances public.fn_protect_profile_privilege_fields() trigger to automatically synchronize
--                 role = 'admin' whenever an administrative subrole is assigned.
--              4. Extends public.public_profiles view with avatar_url so that challenge participants
--                 and social components resolve user names and avatars without hitting private RLS locks.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Self-Healing Data Synchronization: Sync role with admin_role
-- ------------------------------------------------------------------------------

update public.profiles
set role = 'admin', updated_at = now()
where admin_role in ('super_admin', 'content_admin', 'operations_admin', 'moderator')
  and role != 'admin';

-- ------------------------------------------------------------------------------
-- 2. Defensive Authorization Helper Functions
-- ------------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or admin_role in ('super_admin', 'content_admin', 'operations_admin', 'moderator'))
      and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.is_mentor_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('mentor', 'admin') or admin_role in ('super_admin', 'content_admin', 'operations_admin', 'moderator'))
      and coalesce(status, 'active') = 'active'
  );
$$;

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
  if v_role != 'admin' and (v_admin_role is null or v_admin_role not in ('super_admin', 'content_admin', 'operations_admin', 'moderator')) then
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
    'view_audit_logs'
  ) then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_mentor_or_admin() to authenticated, anon;
grant execute on function public.has_admin_permission(text) to authenticated, anon;

-- ------------------------------------------------------------------------------
-- 3. Enhance Profile Privilege Field Protection Trigger
-- ------------------------------------------------------------------------------

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
  -- Allow migrations/service role without auth.uid()
  if v_caller_id is null then
    -- Ensure consistency even on service role writes
    if new.admin_role in ('super_admin', 'content_admin', 'operations_admin', 'moderator') and new.role != 'admin' then
      new.role := 'admin';
    end if;
    return new;
  end if;

  -- ----------------------------------------------------------------------------
  -- INSERT Logic: Prevent self-registration with elevated roles
  -- ----------------------------------------------------------------------------
  if tg_op = 'INSERT' then
    if not public.has_admin_permission('manage_roles') then
      new.id := v_caller_id;
      new.role := 'student';
      new.admin_role := null;
      new.status := 'active';
    else
      -- If super_admin inserts with admin subrole, ensure role is 'admin'
      if new.admin_role in ('super_admin', 'content_admin', 'operations_admin', 'moderator') then
        new.role := 'admin';
      elsif new.role != 'admin' then
        new.admin_role := null;
      end if;
    end if;

    return new;
  end if;

  -- ----------------------------------------------------------------------------
  -- UPDATE Logic: Prevent unauthorized role or status modification
  -- ----------------------------------------------------------------------------
  if tg_op = 'UPDATE' then
    -- Case A: User attempting to modify their own profile
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

    -- Case B: Caller is modifying role or admin_role of any user
    if (new.role is distinct from old.role) or (new.admin_role is distinct from old.admin_role) then
      if not public.has_admin_permission('manage_roles') then
        raise exception 'Unauthorized: Only Super Administrators can modify user roles or administrative sub-roles.'
          using errcode = '42501';
      end if;

      -- If an admin subrole is assigned, automatically ensure role is 'admin'
      if new.admin_role in ('super_admin', 'content_admin', 'operations_admin', 'moderator') then
        new.role := 'admin';
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

      -- Prevent deactivating the last active administrator
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
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. Rebuild public_profiles View with avatar_url
-- ------------------------------------------------------------------------------

drop view if exists public.public_profiles cascade;

create view public.public_profiles with (security_invoker = false) as
select
  id,
  full_name,
  role,
  avatar_url,
  created_at
from public.profiles
where coalesce(status, 'active') = 'active';

grant select on public.public_profiles to authenticated, anon;

