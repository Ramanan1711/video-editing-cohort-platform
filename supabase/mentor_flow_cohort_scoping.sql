-- supabase/mentor_flow_cohort_scoping.sql
-- Mentor Flow & Cohort Scoping Security Migration
--
-- Objectives:
-- 1. Restrict mentor visibility of submissions strictly to their assigned cohorts.
-- 2. Ensure atomic review operations verify mentor-to-cohort assignment at the database level.
-- 3. Provide helper functions and RLS policies that prevent data leakage across cohorts.

-- ==============================================================================
-- 1. Mentor Cohorts Table & Indexes
-- ==============================================================================
create table if not exists public.mentor_cohorts (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references auth.users(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (mentor_id, cohort_id)
);

create index if not exists idx_mentor_cohorts_mentor on public.mentor_cohorts(mentor_id);
create index if not exists idx_mentor_cohorts_cohort on public.mentor_cohorts(cohort_id);

alter table public.mentor_cohorts enable row level security;

-- Policies on mentor_cohorts
drop policy if exists "Mentors can read own assignments and admins can read all" on public.mentor_cohorts;
create policy "Mentors can read own assignments and admins can read all"
  on public.mentor_cohorts for select
  to authenticated
  using (
    mentor_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "Admins have full management on mentor_cohorts" on public.mentor_cohorts;
create policy "Admins have full management on mentor_cohorts"
  on public.mentor_cohorts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ==============================================================================
-- 2. Security Definer Helper Functions for Cohort Scoping
-- ==============================================================================

-- Check if current user is an admin or assigned mentor to a specific cohort
create or replace function public.is_mentor_assigned_to_cohort(p_cohort_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status != 'suspended'
      and (
        p.role = 'admin'
        or (
          p.role = 'mentor'
          and exists (
            select 1 from public.mentor_cohorts mc
            where mc.cohort_id = p_cohort_id
              and mc.mentor_id = auth.uid()
          )
        )
      )
  );
$$;

-- Check if current user is an admin or assigned mentor to the cohort containing a specific submission
create or replace function public.is_mentor_assigned_to_submission(p_submission_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status != 'suspended'
      and (
        p.role = 'admin'
        or (
          p.role = 'mentor'
          and exists (
            select 1
            from public.submissions s
            join public.assignments a on a.id = s.assignment_id
            join public.lessons l on l.id = a.lesson_id
            join public.modules m on m.id = l.module_id
            join public.mentor_cohorts mc on mc.cohort_id = m.cohort_id
            where s.id = p_submission_id
              and mc.mentor_id = auth.uid()
          )
        )
      )
  );
$$;

-- ==============================================================================
-- 3. Fortify Submissions RLS Policies (Drop Overly Permissive Policies)
-- ==============================================================================

-- Drop existing broad read policies on submissions
drop policy if exists "Mentors and Admins can view all submissions" on public.submissions;
drop policy if exists "Staff can view submissions" on public.submissions;
drop policy if exists "Students can read own submissions and staff can read all" on public.submissions;
drop policy if exists "Authenticated users can read submissions" on public.submissions;
drop policy if exists "Submissions readable by student owner, assigned mentors, and admins" on public.submissions;

-- Scoped read policy:
-- 1. Student can read their own submissions (if not suspended)
-- 2. Admin can read all submissions (if not suspended)
-- 3. Mentor can ONLY read submissions if assigned to the cohort the submission belongs to
create policy "Submissions readable by student owner, assigned mentors, and admins"
  on public.submissions for select
  to authenticated
  using (
    (
      student_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and status != 'suspended'
      )
    )
    or public.is_mentor_assigned_to_submission(submissions.id)
  );

-- Fortify submission update policy
drop policy if exists "Mentors and Admins can update submissions" on public.submissions;
drop policy if exists "Students and staff can update submissions" on public.submissions;
drop policy if exists "Submissions updatable by student owner, assigned mentors, and admins" on public.submissions;

create policy "Submissions updatable by student owner, assigned mentors, and admins"
  on public.submissions for update
  to authenticated
  using (
    (
      student_id = auth.uid()
      and status = 'draft'
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and status != 'suspended'
      )
    )
    or public.is_mentor_assigned_to_submission(submissions.id)
  )
  with check (
    (
      student_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and status != 'suspended'
      )
    )
    or public.is_mentor_assigned_to_submission(submissions.id)
  );

-- ==============================================================================
-- 4. Fortify Feedback RLS Policies
-- ==============================================================================
drop policy if exists "Feedback readable by submission owner, mentors, and admins" on public.feedback;
drop policy if exists "Feedback readable by submission owner, assigned mentors, and admins" on public.feedback;

create policy "Feedback readable by submission owner, assigned mentors, and admins"
  on public.feedback for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = feedback.submission_id
        and s.student_id = auth.uid()
    )
    or public.is_mentor_assigned_to_submission(feedback.submission_id)
  );

drop policy if exists "Mentors and admins can insert feedback" on public.feedback;
drop policy if exists "Assigned mentors and admins can insert feedback" on public.feedback;

create policy "Assigned mentors and admins can insert feedback"
  on public.feedback for insert
  to authenticated
  with check (
    public.is_mentor_assigned_to_submission(submission_id)
  );

-- ==============================================================================
-- 5. Fortified Atomic Review RPC Function (review_submission_v2)
-- ==============================================================================
create or replace function public.review_submission_v2(
  p_submission_id uuid,
  p_status text,
  p_comments text,
  p_rubric jsonb default '{}'::jsonb,
  p_timestamped_notes jsonb default '[]'::jsonb,
  p_private_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_is_assigned boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required: You must be logged in';
  end if;

  -- Validate role and non-suspended status
  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role in ('mentor', 'admin')
      and status != 'suspended'
  ) then
    raise exception 'Access denied: Only active mentors or administrators can review submissions';
  end if;

  -- Verify cohort assignment
  v_is_assigned := public.is_mentor_assigned_to_submission(p_submission_id);
  if not v_is_assigned then
    raise exception 'Access denied: You are not assigned to mentor the cohort for this submission';
  end if;

  if p_status not in ('reviewed', 'resubmit') then
    raise exception 'Invalid review status: Status must be "reviewed" or "resubmit"';
  end if;

  if not exists (
    select 1
    from public.submissions
    where id = p_submission_id
  ) then
    raise exception 'Submission not found';
  end if;

  -- Record feedback entry
  insert into public.feedback (
    submission_id,
    mentor_id,
    comments,
    rubric,
    timestamped_notes,
    private_notes
  )
  values (
    p_submission_id,
    v_user_id,
    coalesce(trim(p_comments), ''),
    coalesce(p_rubric, '{}'::jsonb),
    coalesce(p_timestamped_notes, '[]'::jsonb),
    p_private_notes
  );

  -- Update submission status and private note
  update public.submissions
  set
    status = p_status,
    private_notes = coalesce(p_private_notes, private_notes),
    updated_at = now()
  where id = p_submission_id;
end;
$$;

grant execute
on function public.review_submission_v2(uuid, text, text, jsonb, jsonb, text)
to authenticated;

