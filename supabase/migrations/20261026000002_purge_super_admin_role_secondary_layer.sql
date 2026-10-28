-- ==============================================================================
-- Migration: 20261026000002_purge_super_admin_role_secondary_layer.sql
-- Description:
-- Strictly 2 Admin Roles in Secondary Layer (admin_role):
--   1. parent_super_admin (ajayramanan17@gmail.com)
--   2. child_super_admin (ajayramanan4444@gmail.com and all secondary admins)
--
-- Completely removes 'super_admin' from secondary layer:
--   - Updates existing profiles with admin_role = 'super_admin' to their canonical roles.
--   - Sets ajayramanan17@gmail.com -> role = 'admin', admin_role = 'parent_super_admin'
--   - Sets ajayramanan4444@gmail.com -> role = 'admin', admin_role = 'child_super_admin'
--   - Enforces profiles_admin_role_check check constraint (only parent_super_admin and child_super_admin).
--   - Updates public.fn_protect_profile_privilege_fields() trigger function.
--   - Updates public.has_admin_permission() helper function.
--   - Updates public.admin_update_user_role() RPC.
--   - Updates audit log policies and procedures to use parent_super_admin.
--   - Synchronizes auth.users raw_user_meta_data.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Upgrade Trigger fn_protect_profile_privilege_fields() FIRST
--    (Ensures subsequent data migration updates are not blocked or mismanaged)
-- ------------------------------------------------------------------------------
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
    elsif new.admin_role is null or new.admin_role not in ('parent_super_admin', 'child_super_admin') then
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
      elsif new.admin_role not in ('parent_super_admin', 'child_super_admin') then
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

    -- Caller modifying role or admin_role of another user
    if (new.role is distinct from old.role) or (new.admin_role is distinct from old.admin_role) then
      if not public.has_admin_permission('manage_roles') then
        raise exception 'Unauthorized: Only Parent Super Admin can modify user roles or administrative sub-roles.'
          using errcode = '42501';
      end if;

      -- If role is not admin, admin_role must be null
      if new.role != 'admin' then
        new.admin_role := null;
      elsif new.admin_role not in ('parent_super_admin', 'child_super_admin') then
        new.admin_role := 'child_super_admin';
      end if;

      -- Protection: Root Parent Super Admin (Ramanan) cannot be demoted or changed
      if (old.email = 'ajayramanan17@gmail.com' or old.id = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b') and
         (new.role != 'admin' or new.admin_role != 'parent_super_admin') then
        raise exception 'Safety block: Cannot demote or revoke the root Parent Super Admin.'
          using errcode = 'P0001';
      end if;

      -- Protection: Ensure at least one active Parent Super Admin remains
      if old.role = 'admin' and old.admin_role = 'parent_super_admin' and
         (new.role != 'admin' or new.admin_role != 'parent_super_admin') then
        select count(*) into v_parent_admin_count
        from public.profiles
        where role = 'admin' and admin_role = 'parent_super_admin' and coalesce(status, 'active') = 'active';

        if v_parent_admin_count <= 1 then
          raise exception 'Safety block: Cannot demote or revoke the last remaining active Parent Super Admin.'
            using errcode = 'P0001';
        end if;
      end if;
    end if;

    -- Caller modifying user status
    if new.status is distinct from old.status then
      if not public.has_admin_permission('manage_user_status') then
        raise exception 'Unauthorized: Only administrators can modify user status.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. Data Migration: Canonical Roles for Ramanan, Ajay, and all other users
-- ------------------------------------------------------------------------------

-- Sanitize any invalid or null roles
update public.profiles
set role = 'student'
where role is null or role not in ('student', 'mentor', 'admin');

-- Ensure non-admins strictly have admin_role = null
update public.profiles
set admin_role = null, updated_at = now()
where role is distinct from 'admin' or role in ('student', 'mentor');

-- Ensure Ramanan is canonical Parent Super Admin
update public.profiles
set 
  role = 'admin',
  admin_role = 'parent_super_admin',
  status = 'active',
  updated_at = now()
where email = 'ajayramanan17@gmail.com' or id = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b';

-- Ensure Ajay is canonical Child Super Admin
update public.profiles
set 
  role = 'admin',
  admin_role = 'child_super_admin',
  status = 'active',
  updated_at = now()
where email = 'ajayramanan4444@gmail.com' or id = '591e5ba9-2d77-4f7f-ab8b-ed9f97ebda55';

-- Normalize any other administrators to Child Super Admin
update public.profiles
set admin_role = 'child_super_admin', updated_at = now()
where role = 'admin'
  and (email is distinct from 'ajayramanan17@gmail.com' and id is distinct from 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b')
  and (admin_role is distinct from 'child_super_admin');

-- Synchronize auth.users raw_user_meta_data for Ramanan and Ajay
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin', 'admin_role', 'parent_super_admin')
where email = 'ajayramanan17@gmail.com' or id = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b';

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin', 'admin_role', 'child_super_admin')
where email = 'ajayramanan4444@gmail.com' or id = '591e5ba9-2d77-4f7f-ab8b-ed9f97ebda55';

-- ------------------------------------------------------------------------------
-- 3. Strict Check Constraint: ONLY parent_super_admin and child_super_admin
-- ------------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_admin_role_check;

alter table public.profiles
  add constraint profiles_admin_role_check
  check (
    (role = 'admin' and admin_role in ('parent_super_admin', 'child_super_admin'))
    or (role in ('student', 'mentor') and admin_role is null)
  );

-- ------------------------------------------------------------------------------
-- 4. Authoritative public.has_admin_permission Helper
-- ------------------------------------------------------------------------------
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
  if v_admin_role = 'parent_super_admin' then
    return true;
  end if;

  -- Child Super Admin holds all operational and platform permissions, EXCEPT manage_roles
  if v_admin_role = 'child_super_admin' and p_permission != 'manage_roles' then
    return true;
  end if;

  return false;
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC public.admin_update_user_role
-- ------------------------------------------------------------------------------
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
  v_resolved_admin_role text;
begin
  -- 1. Caller verification: Only Parent Super Admin can modify roles
  select id, email, role, admin_role, status
  into v_caller_profile
  from public.profiles
  where id = auth.uid();

  if not found or coalesce(v_caller_profile.status, 'active') != 'active' or 
     v_caller_profile.role != 'admin' or
     v_caller_profile.admin_role != 'parent_super_admin' then
    raise exception 'Unauthorized: Only Parent Super Admin can add or modify roles.'
      using errcode = '42501';
  end if;

  -- 2. Validate target role
  if p_new_role not in ('student', 'mentor', 'admin') then
    raise exception 'Invalid role: % is not a recognized system role.', p_new_role
      using errcode = '22000';
  end if;

  -- 3. Resolve admin_role strictly according to 4-tier model:
  -- If role = 'admin', admin_role must be 'child_super_admin' (or 'parent_super_admin' for Ramanan)
  -- If role in ('student', 'mentor'), admin_role must be null
  if p_new_role = 'admin' then
    v_resolved_admin_role := coalesce(p_new_admin_role, 'child_super_admin');
    if v_resolved_admin_role not in ('parent_super_admin', 'child_super_admin') then
      v_resolved_admin_role := 'child_super_admin';
    end if;
  else
    v_resolved_admin_role := null;
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
  if (v_target_profile.email = 'ajayramanan17@gmail.com' or v_target_profile.id = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b') and 
     (p_new_role != 'admin' or v_resolved_admin_role != 'parent_super_admin') then
    raise exception 'Cannot demote or revoke the root Parent Super Admin.'
      using errcode = 'P0001';
  end if;

  -- 6. Apply update
  update public.profiles
  set
    role = p_new_role,
    admin_role = v_resolved_admin_role,
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
      'new_admin_role', v_resolved_admin_role,
      'user_email', v_target_profile.email,
      'updated_by', v_caller_profile.email
    )
  );

  return to_jsonb(v_updated);
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. Update Audit Log Policies & Procedure
-- ------------------------------------------------------------------------------
drop policy if exists "Authenticated users can read audit logs" on public.audit_logs;
create policy "Authenticated users can read audit logs"
  on public.audit_logs for select
  to authenticated
  using (
    public.has_admin_permission('view_audit_logs') or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and admin_role in ('parent_super_admin', 'child_super_admin')
    )
  );

drop policy if exists "Authenticated users can insert self-attributed audit logs" on public.audit_logs;
create policy "Authenticated users can insert self-attributed audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (
    actor_id is null or
    actor_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and admin_role = 'parent_super_admin'
    )
  );

create or replace function public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_actor_id uuid;
  v_actor_email text;
  v_actor_role text;
  v_is_parent_admin boolean := false;
  v_headers jsonb;
  v_ip text;
  v_user_agent text;
  v_log_id uuid;
begin
  v_caller_id := auth.uid();

  -- Check if caller is Parent Super Admin
  if v_caller_id is not null then
    select (role = 'admin' and admin_role = 'parent_super_admin')
    into v_is_parent_admin
    from public.profiles
    where id = v_caller_id;

    if not coalesce(v_is_parent_admin, false) then
      v_actor_id := v_caller_id;
    else
      v_actor_id := coalesce(p_actor_id, v_caller_id);
    end if;
  else
    v_actor_id := p_actor_id;
  end if;

  if v_actor_id is not null then
    select email, role into v_actor_email, v_actor_role
    from public.profiles
    where id = v_actor_id;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    if v_headers is not null then
      v_ip := coalesce(
        v_headers->>'cf-connecting-ip',
        v_headers->>'x-real-ip',
        split_part(v_headers->>'x-forwarded-for', ',', 1)
      );
      v_user_agent := v_headers->>'user-agent';
    end if;
  exception when others then
    v_ip := null;
    v_user_agent := null;
  end;

  insert into public.audit_logs (
    actor_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata,
    ip_address,
    user_agent,
    created_at
  ) values (
    v_actor_id,
    v_actor_email,
    v_actor_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_metadata,
    v_ip,
    v_user_agent,
    now()
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

