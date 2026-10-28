-- ==============================================================================
-- Migration: 20261014000001_fix_admin_role_default_and_restore_user_roles.sql
-- Description:
--   1. Removes the default 'super_admin' on public.profiles.admin_role.
--   2. Updates fn_protect_profile_privilege_fields() so setting role != 'admin'
--      automatically clears admin_role to null (preventing auto-escalation).
--   3. Restores user accounts to their proper roles (students, mentor, admin).
--   4. Clears admin_role on all non-admin profiles.
--   5. Synchronizes auth.users raw_user_meta_data to match restored roles.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Remove dangerous column default on admin_role
-- ------------------------------------------------------------------------------
alter table public.profiles alter column admin_role drop default;
alter table public.profiles alter column admin_role set default null;

-- ------------------------------------------------------------------------------
-- 2. Upgrade fn_protect_profile_privilege_fields() trigger
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
begin
  -- Service role / migration operations without auth.uid()
  if v_caller_id is null then
    if new.role != 'admin' then
      new.admin_role := null;
    elsif new.admin_role in ('parent_super_admin', 'child_super_admin', 'super_admin', 'content_admin', 'operations_admin', 'moderator') then
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
      if new.role != 'admin' then
        new.admin_role := null;
      elsif new.admin_role in ('parent_super_admin', 'child_super_admin', 'super_admin', 'content_admin', 'operations_admin', 'moderator') then
        new.role := 'admin';
      end if;
    end if;
    return new;
  end if;

  -- ----------------------------------------------------------------------------
  -- UPDATE Logic: Prevent unauthorized role or status modification
  -- ----------------------------------------------------------------------------
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

    -- Caller is modifying role or admin_role of any user
    if (new.role is distinct from old.role) or (new.admin_role is distinct from old.admin_role) then
      if not public.has_admin_permission('manage_roles') then
        raise exception 'Unauthorized: Only Super Administrators can modify user roles or administrative sub-roles.'
          using errcode = '42501';
      end if;

      -- If role is demoted to student or mentor, clear admin_role automatically
      if new.role != 'admin' then
        new.admin_role := null;
      elsif new.admin_role in ('parent_super_admin', 'child_super_admin', 'super_admin', 'content_admin', 'operations_admin', 'moderator') then
        new.role := 'admin';
      end if;

      -- Protect against demoting the last active super_admin / parent_super_admin
      if old.role = 'admin' and coalesce(old.admin_role, 'parent_super_admin') in ('parent_super_admin', 'super_admin') and
         (new.role != 'admin' or coalesce(new.admin_role, 'parent_super_admin') not in ('parent_super_admin', 'super_admin')) then
        select count(*) into v_super_admin_count
        from public.profiles
        where role = 'admin' and coalesce(admin_role, 'parent_super_admin') in ('parent_super_admin', 'super_admin') and coalesce(status, 'active') = 'active';

        if v_super_admin_count <= 1 then
          raise exception 'Safety block: Cannot demote or revoke the last remaining active Super Admin.'
            using errcode = 'P0001';
        end if;
      end if;
    end if;

    -- Caller is modifying user status
    if new.status is distinct from old.status then
      if not public.has_admin_permission('manage_users') then
        raise exception 'Unauthorized: Only administrators can modify user status.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. Restore User Accounts to Their Proper Roles
-- ------------------------------------------------------------------------------

-- DEMO 1 -> student
update public.profiles
set role = 'student', admin_role = null, updated_at = now()
where id = '0c0ed9ee-9ff7-4f07-8ab8-9cbe1f114f5f' or email = 'studtesting1@gmail.com';

-- Demo 2 -> student
update public.profiles
set role = 'student', admin_role = null, updated_at = now()
where id = '30461729-b21e-450a-8778-8be449a512c2' or email = 'studtesting2@gmail.com';

-- Ajay -> student
update public.profiles
set role = 'student', admin_role = null, updated_at = now()
where id = '591e5ba9-2d77-4f7f-ab8b-ed9f97ebda55' or email = 'ajayramanan4444@gmail.com';

-- WE -> student
update public.profiles
set role = 'student', admin_role = null, updated_at = now()
where id = 'a3f04aa2-0643-448d-aebc-2ad35941defd' or email = 'weyolow322@blobapps.com';

-- AR -> mentor
update public.profiles
set role = 'mentor', admin_role = null, updated_at = now()
where id = 'e32aa097-6285-4927-89c4-666b88af76d7' or email = 'ajayramanan2800@gmail.com';

-- Ramanan -> admin (parent_super_admin)
update public.profiles
set role = 'admin', admin_role = 'parent_super_admin', updated_at = now()
where id = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b' or email = 'ajayramanan17@gmail.com';

-- General cleanup: ensure no non-admin profile has an admin_role set
update public.profiles
set admin_role = null
where role != 'admin' and admin_role is not null;

-- ------------------------------------------------------------------------------
-- 4. Sync auth.users metadata for clean JWT role generation
-- ------------------------------------------------------------------------------
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role": "student"}'::jsonb
where id in (
  '0c0ed9ee-9ff7-4f07-8ab8-9cbe1f114f5f',
  '30461729-b21e-450a-8778-8be449a512c2',
  '591e5ba9-2d77-4f7f-ab8b-ed9f97ebda55',
  'a3f04aa2-0643-448d-aebc-2ad35941defd'
);

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role": "mentor"}'::jsonb
where id = 'e32aa097-6285-4927-89c4-666b88af76d7';

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin", "admin_role": "parent_super_admin"}'::jsonb
where id = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b';

