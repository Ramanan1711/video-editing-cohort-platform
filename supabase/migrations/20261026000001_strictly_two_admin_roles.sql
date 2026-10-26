-- ==============================================================================
-- Migration: 20261026000001_strictly_two_admin_roles.sql
-- Description:
-- 1. Normalizes admin_role: strictly two admin sub-roles exist:
--    'parent_super_admin' and 'child_super_admin' (with 'super_admin' alias).
-- 2. Purges admin_role = 'admin' (standard administrators have role = 'admin' and admin_role = null).
-- 3. Updates constraint and RPCs to enforce this strictly.
-- ==============================================================================

-- 1. Normalize any existing admin_role = 'admin' to NULL
update public.profiles
set admin_role = null, updated_at = now()
where admin_role = 'admin';

-- 2. Restrict profiles_admin_role_check constraint to strictly ('parent_super_admin', 'child_super_admin', 'super_admin') or null
alter table public.profiles
  drop constraint if exists profiles_admin_role_check;

alter table public.profiles
  add constraint profiles_admin_role_check
  check (admin_role is null or admin_role in ('parent_super_admin', 'child_super_admin', 'super_admin'));

-- 3. Ensure Ramanan is canonical Parent Super Admin
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

  -- User must hold role = 'admin'
  if v_role != 'admin' then
    return false;
  end if;

  -- Parent Super Admin holds sovereignty over ALL permissions (including manage_roles)
  if v_admin_role in ('parent_super_admin', 'super_admin') then
    return true;
  end if;

  -- Child Super Admin holds all operational and platform permissions, EXCEPT manage_roles
  if v_admin_role = 'child_super_admin' and p_permission != 'manage_roles' then
    return true;
  end if;

  -- Standard Admin (admin_role is null) holds standard operational permissions
  if v_admin_role is null and p_permission in (
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

  -- 3. Validate target admin subrole: strictly two admin_roles ('parent_super_admin', 'child_super_admin', 'super_admin') or null
  if p_new_admin_role is not null and p_new_admin_role not in ('parent_super_admin', 'child_super_admin', 'super_admin') then
    raise exception 'Invalid admin_role: % is not allowed. Only parent_super_admin and child_super_admin are permitted.', p_new_admin_role
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
    admin_role = case when p_new_role = 'admin' then p_new_admin_role else null end,
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
      'new_admin_role', case when p_new_role = 'admin' then p_new_admin_role else null end,
      'user_email', v_target_profile.email,
      'updated_by', v_caller_profile.email
    )
  );

  return to_jsonb(v_updated);
end;
$$;

