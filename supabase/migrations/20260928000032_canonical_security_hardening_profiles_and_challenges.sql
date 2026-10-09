-- ==============================================================================
-- Migration: 20260928000032_canonical_security_hardening_profiles_and_challenges.sql
-- Description: Comprehensive Security Hardening across Profiles, Challenges & Storage:
--              1. Profile Privilege Escalation Lockdown:
--                 - BEFORE INSERT OR UPDATE trigger on public.profiles forcing
--                   non-admins to id = auth.uid(), role = 'student', admin_role = null, status = 'active'.
--                 - Bulletproof self-update RLS policy prohibiting mutation of role,
--                   admin_role, or status.
--                 - Admin update policy requiring manage_roles / manage_user_status.
--              2. Elimination of Broad Profile Reads:
--                 - Drops any legacy open SELECT policies (using true) on public.profiles.
--                 - Strict SELECT policies: Own profile only, Admin, or Assigned Cohort Mentor.
--                 - Sanitized public.public_profiles view for community/peer displays
--                   (id, full_name, role, avatar_url, created_at - zero contact fields).
--              3. Daily Challenges & Submissions Policy Hardening:
--                 - public.daily_challenges scoped to enrolled cohort students, assigned mentors, admins.
--                 - Eliminates permissive "Students can manage own challenge submissions" FOR ALL policy.
--                 - Enforces separate SELECT, INSERT, UPDATE, DELETE policies on daily_challenge_submissions.
--                 - Student can only submit for enrolled cohorts with status = 'pending'.
--                 - Student cannot self-grade, set score, or alter status to 'accepted'.
--                 - Only assigned cohort mentors and admins can grade and review challenges.
--                 - Anti-tamper trigger trg_enforce_daily_challenge_submission_integrity.
--              4. Storage Bucket Privacy Lockdown:
--                 - Re-verifies both 'course-assets' and 'submissions' have public = false.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Profile Privilege Escalation Lockdown
-- ------------------------------------------------------------------------------

-- Enhanced trigger function protecting profile privilege fields on both INSERT and UPDATE
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
  -- If trigger executed by internal migrations or service role without auth.uid(), allow
  if v_caller_id is null then
    return new;
  end if;

  -- ----------------------------------------------------------------------------
  -- INSERT Logic: Prevent self-registration with elevated roles
  -- ----------------------------------------------------------------------------
  if tg_op = 'INSERT' then
    -- Non-super admins cannot insert admin/mentor roles
    if not public.has_admin_permission('manage_roles') then
      new.id := v_caller_id;
      new.role := 'student';
      new.admin_role := null;
      new.status := 'active';
    else
      -- Even if admin inserts, validate consistency
      if new.role != 'admin' then
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
      -- Cannot alter role
      if new.role is distinct from old.role then
        raise exception 'Unauthorized: Users cannot alter their own system role.'
          using errcode = '42501';
      end if;

      -- Cannot alter admin_role
      if new.admin_role is distinct from old.admin_role then
        raise exception 'Unauthorized: Users cannot alter their own administrative sub-role.'
          using errcode = '42501';
      end if;

      -- Cannot alter account status
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

drop trigger if exists trg_protect_profile_privilege_fields on public.profiles;
create trigger trg_protect_profile_privilege_fields
  before insert or update on public.profiles
  for each row
  execute function public.fn_protect_profile_privilege_fields();

-- Airtight RLS on public.profiles
alter table public.profiles enable row level security;

-- Self-insert policy: strictly student role and null admin_role
drop policy if exists "Users can insert own initial profile" on public.profiles;
create policy "Users can insert own initial profile"
  on public.profiles for insert
  to authenticated
  with check (
    id = auth.uid()
    and role = 'student'
    and admin_role is null
    and coalesce(status, 'active') = 'active'
  );

-- Self-update policy: display fields only, no role or status mutation
drop policy if exists "Users can update own display name" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
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

-- Admin-update policy: strictly guarded by granular permissions
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

-- ------------------------------------------------------------------------------
-- 2. Elimination of Broad Profile Reads & Exposure of Sanitized View
-- ------------------------------------------------------------------------------

-- Drop all legacy or open SELECT policies on public.profiles
drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Anyone can read profiles" on public.profiles;
drop policy if exists "Users can read own full profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Mentors can read cohort student profiles" on public.profiles;

-- 1. Users can read their OWN full profile (including email, whatsapp, etc.)
create policy "Users can read own full profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- 2. Administrators can read all profiles
create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- 3. Mentors can read full profiles of students in cohorts they mentor
create policy "Mentors can read cohort student profiles"
  on public.profiles for select
  to authenticated
  using (public.is_mentor_for_student(id));

-- Ensure optional avatar_url column exists on profiles
alter table public.profiles
  add column if not exists avatar_url text;

-- Drop view before recreating to prevent column-structure mismatch errors
drop view if exists public.public_profiles cascade;

-- Sanitized Public Profile View for Social / Peer Displays
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

-- Batch helper RPC for safe author resolution
create or replace function public.get_public_profiles(user_ids uuid[])
returns table (
  id uuid,
  full_name text,
  role text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, p.role, p.created_at
  from public.profiles p
  where p.id = any(user_ids)
    and coalesce(p.status, 'active') = 'active';
$$;

grant execute on function public.get_public_profiles(uuid[]) to authenticated, anon;

-- ------------------------------------------------------------------------------
-- 3. Daily Challenges & Submissions Policy Hardening
-- ------------------------------------------------------------------------------

alter table public.daily_challenges enable row level security;
alter table public.daily_challenge_submissions enable row level security;

-- A. daily_challenges: Scoped reading & staff management
drop policy if exists "Authenticated users can read daily challenges" on public.daily_challenges;
drop policy if exists "Enrolled students, mentors and admins can view challenges" on public.daily_challenges;
create policy "Enrolled students, mentors and admins can view challenges"
  on public.daily_challenges for select
  to authenticated
  using (
    public.is_admin()
    or public.is_mentor_for_cohort(cohort_id)
    or exists (
      select 1 from public.enrollments e
      where e.cohort_id = daily_challenges.cohort_id
        and e.user_id = auth.uid()
        and e.status in ('enrolled', 'active', 'completed')
    )
  );

drop policy if exists "Mentors and Admins can manage daily challenges" on public.daily_challenges;
drop policy if exists "Cohort mentors and admins can manage daily challenges" on public.daily_challenges;
create policy "Cohort mentors and admins can manage daily challenges"
  on public.daily_challenges for all
  to authenticated
  using (
    public.is_admin()
    or public.is_mentor_for_cohort(cohort_id)
  )
  with check (
    public.is_admin()
    or public.is_mentor_for_cohort(cohort_id)
  );

-- B. daily_challenge_submissions: Granular RLS & Anti-Self-Grading
drop policy if exists "Students can manage own challenge submissions" on public.daily_challenge_submissions;
drop policy if exists "Challenge submissions select policy" on public.daily_challenge_submissions;
drop policy if exists "Students can insert own challenge submissions" on public.daily_challenge_submissions;
drop policy if exists "Students can update own pending challenge submissions" on public.daily_challenge_submissions;
drop policy if exists "Mentors and admins can grade challenge submissions" on public.daily_challenge_submissions;
drop policy if exists "Users or admins can delete challenge submissions" on public.daily_challenge_submissions;

-- 1. SELECT: Owner, Assigned Cohort Mentor, or Admin
create policy "Challenge submissions select policy"
  on public.daily_challenge_submissions for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.daily_challenges dc
      where dc.id = daily_challenge_submissions.challenge_id
        and public.is_mentor_for_cohort(dc.cohort_id)
    )
  );

-- 2. INSERT: Enrolled student only, initial 'pending' status only, zero scores/feedback
create policy "Students can insert own challenge submissions"
  on public.daily_challenge_submissions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and score is null
    and reviewed_by is null
    and reviewed_at is null
    and mentor_feedback is null
    and exists (
      select 1
      from public.daily_challenges dc
      join public.enrollments e on e.cohort_id = dc.cohort_id
      where dc.id = challenge_id
        and e.user_id = auth.uid()
        and e.status in ('enrolled', 'active', 'completed')
    )
  );

-- 3. UPDATE (Students): Can update submission link/notes while pending/resubmit, cannot self-grade
create policy "Students can update own pending challenge submissions"
  on public.daily_challenge_submissions for update
  to authenticated
  using (
    user_id = auth.uid()
    and status in ('pending', 'resubmit')
  )
  with check (
    user_id = auth.uid()
    and status in ('pending', 'resubmit')
    and score is null
    and reviewed_by is null
    and reviewed_at is null
    and mentor_feedback is null
  );

-- 4. UPDATE (Mentors & Admins): Assigned cohort mentors or admins can grade
create policy "Mentors and admins can grade challenge submissions"
  on public.daily_challenge_submissions for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.daily_challenges dc
      where dc.id = daily_challenge_submissions.challenge_id
        and public.is_mentor_for_cohort(dc.cohort_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.daily_challenges dc
      where dc.id = daily_challenge_submissions.challenge_id
        and public.is_mentor_for_cohort(dc.cohort_id)
    )
  );

-- 5. DELETE: Admins or owner if still pending
create policy "Users or admins can delete challenge submissions"
  on public.daily_challenge_submissions for delete
  to authenticated
  using (
    public.is_admin()
    or (user_id = auth.uid() and status = 'pending')
  );

-- 6. Anti-Tamper Trigger on daily_challenge_submissions
create or replace function public.fn_enforce_daily_challenge_submission_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_is_staff boolean := false;
begin
  if v_caller is null then
    return new;
  end if;

  -- Check if caller is admin or cohort mentor
  select (
    public.is_admin()
    or exists (
      select 1 from public.daily_challenges dc
      where dc.id = old.challenge_id
        and public.is_mentor_for_cohort(dc.cohort_id)
    )
  ) into v_is_staff;

  -- If caller is the student owner and not staff
  if v_caller = old.user_id and not v_is_staff then
    -- Cannot self-grade
    if new.score is distinct from old.score then
      raise exception 'Unauthorized: Students cannot grade or alter challenge scores.'
        using errcode = '42501';
    end if;

    -- Cannot self-accept or self-review
    if new.status in ('accepted', 'reviewed') and old.status not in ('accepted', 'reviewed') then
      raise exception 'Unauthorized: Students cannot self-accept or approve challenge submissions.'
        using errcode = '42501';
    end if;

    -- Cannot forge reviewer fields
    if new.reviewed_by is distinct from old.reviewed_by or
       new.reviewed_at is distinct from old.reviewed_at or
       new.mentor_feedback is distinct from old.mentor_feedback then
      raise exception 'Unauthorized: Students cannot author or modify mentor feedback.'
        using errcode = '42501';
    end if;

    -- Cannot reassign ownership
    if new.user_id is distinct from old.user_id or new.challenge_id is distinct from old.challenge_id then
      raise exception 'Unauthorized: Cannot reassign challenge submission ownership.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_daily_challenge_submission_integrity on public.daily_challenge_submissions;
create trigger trg_enforce_daily_challenge_submission_integrity
  before update on public.daily_challenge_submissions
  for each row
  execute function public.fn_enforce_daily_challenge_submission_integrity();

-- ------------------------------------------------------------------------------
-- 4. Storage Bucket Privacy Lockdown Verification
-- ------------------------------------------------------------------------------
update storage.buckets
set public = false
where id in ('course-assets', 'submissions');
