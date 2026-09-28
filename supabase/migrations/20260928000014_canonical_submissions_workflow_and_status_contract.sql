-- ==============================================================================
-- Migration: 20260928000014_canonical_submissions_workflow_and_status_contract.sql
-- Description: Submissions Feature Hardening & Canonical Workflow Alignment
--   1. Schema Alignment: Ensure public.submissions & public.submission_versions
--      have complete dual-column compatibility (version/version_number, notes,
--      is_late, private_notes, sla_target_hours, escalated fields).
--   2. Status Contract Normalization: Update check constraint on submissions.status
--      to accept ('draft', 'pending', 'reviewed', 'resubmit', 'resubmit_requested',
--      'accepted', 'approved', 'needs_revision').
--   3. Trigger Synchronization:
--      - Auto-synchronize version <-> version_number on insert & update.
--      - Normalization trigger trg_enforce_submission_integrity that normalizes
--        'resubmit_requested'/'needs_revision' -> 'resubmit' and 'accepted'/'approved' -> 'reviewed'.
--      - Protect student status updates from self-approval while allowing legitimate resubmissions.
--   4. RLS Policy Hardening:
--      - Add INSERT policy on public.submission_versions for authenticated students,
--        assigned mentors, and admins.
--      - Broaden submissions update policy to allow updating submissions currently in
--        'resubmit_requested' status.
--   5. Canonical Hierarchy Resolution RPC:
--      - Overhaul submit_student_assignment() to resolve cohort_id via coalesce(a.cohort_id, m.cohort_id),
--        with fallback to student's active enrollment for course modules.
--      - Prevent P0002 hierarchy exceptions for course-scoped or standalone assignments.
-- ==============================================================================

-- 1. Ensure Columns Exist on public.submissions and public.submission_versions
alter table public.submissions
  add column if not exists notes text,
  add column if not exists is_late boolean default false,
  add column if not exists version integer default 1,
  add column if not exists version_number integer default 1,
  add column if not exists private_notes text,
  add column if not exists sla_target_hours integer default 24,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_reason text,
  add column if not exists escalated_by uuid references public.profiles(id);

alter table public.submission_versions
  add column if not exists notes text,
  add column if not exists version integer default 1,
  add column if not exists version_number integer default 1,
  add column if not exists submitted_at timestamptz default now();

-- Ensure indices exist
create index if not exists idx_submissions_student_assignment on public.submissions(student_id, assignment_id);
create index if not exists idx_submissions_status on public.submissions(status);
create index if not exists idx_submission_versions_sub_ver on public.submission_versions(submission_id, version_number);

-- 2. Relax submissions.status Check Constraint to accept canonical workflow states
do $$
begin
  alter table public.submissions drop constraint if exists submissions_status_check;
  alter table public.submissions add constraint submissions_status_check
    check (status in ('draft', 'pending', 'reviewed', 'resubmit', 'resubmit_requested', 'accepted', 'approved', 'needs_revision'));
exception
  when others then null;
end $$;

-- 3. Synchronization & Integrity Triggers

-- Trigger function for public.submissions on INSERT
create or replace function public.trg_sync_submission_columns_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Normalize incoming status
  if new.status = 'resubmit_requested' or new.status = 'needs_revision' or new.status = 'needs_work' then
    new.status := 'resubmit';
  elsif new.status in ('approved', 'accepted') then
    new.status := 'reviewed';
  end if;

  -- Synchronize version and version_number
  if new.version_number is not null and (new.version is null or new.version <> new.version_number) then
    new.version := new.version_number;
  elsif new.version is not null and (new.version_number is null or new.version_number <> new.version) then
    new.version_number := new.version;
  elsif new.version is null and new.version_number is null then
    new.version := 1;
    new.version_number := 1;
  end if;

  if new.created_at is null then
    new.created_at := now();
  end if;
  if new.updated_at is null then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_submission_columns_insert on public.submissions;
create trigger trg_sync_submission_columns_insert
  before insert on public.submissions
  for each row
  execute function public.trg_sync_submission_columns_insert();

-- Trigger function for public.submissions on UPDATE (enforces integrity & status normalization)
create or replace function public.trg_enforce_submission_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Prevent student_id tampering on existing submission
  if new.student_id <> old.student_id then
    raise exception 'Unauthorized: Cannot modify student_id on an existing submission.'
      using errcode = '42501';
  end if;

  -- Prevent assignment_id tampering on existing submission
  if new.assignment_id <> old.assignment_id then
    raise exception 'Unauthorized: Cannot modify assignment_id on an existing submission.'
      using errcode = '42501';
  end if;

  -- Normalize incoming status
  if new.status = 'resubmit_requested' or new.status = 'needs_revision' or new.status = 'needs_work' then
    new.status := 'resubmit';
  elsif new.status in ('approved', 'accepted') then
    new.status := 'reviewed';
  end if;

  -- Prevent students from self-approving or setting status to 'reviewed'
  if not public.is_mentor_or_admin() then
    if new.status = 'reviewed' and old.status <> 'reviewed' then
      raise exception 'Unauthorized: Only designated cohort mentors and platform administrators can mark submissions as reviewed.'
        using errcode = '42501';
    end if;

    -- Students can only transition submissions between draft, pending, and resubmit
    if new.status not in ('draft', 'pending', 'resubmit') then
      raise exception 'Unauthorized: Invalid submission status % requested by student.', new.status
        using errcode = '42501';
    end if;
  end if;

  -- Keep version and version_number in sync
  if new.version_number is not null and (new.version is null or new.version <> new.version_number) then
    new.version := new.version_number;
  elsif new.version is not null and (new.version_number is null or new.version_number <> new.version) then
    new.version_number := new.version;
  elsif new.version is null and new.version_number is null then
    new.version := 1;
    new.version_number := 1;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_submission_integrity on public.submissions;
create trigger trg_enforce_submission_integrity
  before update on public.submissions
  for each row
  execute function public.trg_enforce_submission_integrity();

-- Trigger function for public.submission_versions on INSERT or UPDATE
create or replace function public.trg_sync_submission_versions_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Normalize status
  if new.status = 'resubmit_requested' or new.status = 'needs_revision' or new.status = 'needs_work' then
    new.status := 'resubmit';
  elsif new.status in ('approved', 'accepted') then
    new.status := 'reviewed';
  end if;

  -- Synchronize version and version_number
  if new.version_number is not null and (new.version is null or new.version <> new.version_number) then
    new.version := new.version_number;
  elsif new.version is not null and (new.version_number is null or new.version_number <> new.version) then
    new.version_number := new.version;
  elsif new.version is null and new.version_number is null then
    new.version := 1;
    new.version_number := 1;
  end if;

  if new.created_at is null then
    new.created_at := now();
  end if;
  if new.submitted_at is null then
    new.submitted_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_submission_versions_columns on public.submission_versions;
create trigger trg_sync_submission_versions_columns
  before insert or update on public.submission_versions
  for each row
  execute function public.trg_sync_submission_versions_columns();

-- 4. RLS Policy Hardening for Submissions and Submission Versions

-- Allow students to update own submissions even if current status is 'resubmit_requested'
drop policy if exists "Students can update own submissions" on public.submissions;
create policy "Students can update own submissions"
  on public.submissions for update
  to authenticated
  using (
    student_id = auth.uid()
    and public.is_active_user()
    and status in ('draft', 'pending', 'resubmit', 'resubmit_requested')
  )
  with check (
    student_id = auth.uid()
    and public.is_active_user()
    and status in ('draft', 'pending', 'resubmit')
  );

-- Ensure authenticated students, assigned mentors, and admins can insert submission versions
drop policy if exists "Authenticated users can insert own submission versions" on public.submission_versions;
drop policy if exists "Users can insert own submission versions" on public.submission_versions;
create policy "Authenticated users can insert own submission versions"
  on public.submission_versions for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_versions.submission_id
      and (
        (s.student_id = auth.uid() and public.is_active_user())
        or public.is_mentor_for_student(s.student_id)
      )
    )
  );

-- Ensure SELECT policy on public.submission_versions is complete
drop policy if exists "Students can view own submission versions" on public.submission_versions;
create policy "Students can view own submission versions"
  on public.submission_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_versions.submission_id
      and (
        (s.student_id = auth.uid() and public.is_active_user())
        or public.is_mentor_for_student(s.student_id)
        or public.is_admin()
      )
    )
  );

-- 5. Canonical Server-Side Submission RPC (submit_student_assignment)
create or replace function public.submit_student_assignment(
  p_assignment_id uuid,
  p_file_url text,
  p_is_draft boolean default false,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_cohort_id uuid;
  v_course_id uuid;
  v_deadline timestamptz;
  v_new_status text;
  v_is_late boolean := false;
  v_existing record;
  v_new_version integer := 1;
  v_result record;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Authentication required to submit assignment.'
      using errcode = '42501';
  end if;

  if not public.is_active_user() then
    raise exception 'Account is not active. Submissions are disabled.'
      using errcode = 'P0001';
  end if;

  -- 1. Verify assignment exists and resolve hierarchy (cohort_id, module, course, deadline)
  select
    coalesce(a.cohort_id, m.cohort_id),
    a.deadline,
    m.course_id
  into
    v_cohort_id,
    v_deadline,
    v_course_id
  from public.assignments a
  left join public.lessons l on l.id = a.lesson_id
  left join public.modules m on m.id = l.module_id
  where a.id = p_assignment_id;

  if not exists (select 1 from public.assignments where id = p_assignment_id) then
    raise exception 'Assignment % not found.', p_assignment_id
      using errcode = 'P0002';
  end if;

  -- 2. Fallback resolution for cohort_id via student enrollments if not directly resolved
  if v_cohort_id is null and v_course_id is not null then
    select e.cohort_id into v_cohort_id
    from public.enrollments e
    join public.cohorts c on c.id = e.cohort_id
    where e.user_id = v_student_id
      and e.status in ('enrolled', 'active')
      and c.course_id = v_course_id
    limit 1;
  end if;

  if v_cohort_id is null then
    select e.cohort_id into v_cohort_id
    from public.enrollments e
    where e.user_id = v_student_id
      and e.status in ('enrolled', 'active')
    order by e.created_at desc
    limit 1;
  end if;

  -- 3. Check active enrollment in cohort (unless admin)
  if v_cohort_id is not null and not exists (
    select 1 from public.enrollments
    where cohort_id = v_cohort_id
      and user_id = v_student_id
      and status in ('enrolled', 'active')
  ) and not public.is_admin() then
    raise exception 'You must be actively enrolled in this cohort to submit assignments.'
      using errcode = '42501';
  end if;

  if v_deadline is not null and now() > v_deadline then
    v_is_late := true;
  end if;

  if p_is_draft then
    v_new_status := 'draft';
  else
    v_new_status := 'pending';
  end if;

  select id, coalesce(version_number, version, 1) as ver, file_url, notes, status
  into v_existing
  from public.submissions
  where assignment_id = p_assignment_id and student_id = v_student_id;

  if found then
    v_new_version := coalesce(v_existing.ver, 1) + 1;

    insert into public.submission_versions (
      submission_id,
      version_number,
      version,
      file_url,
      notes,
      status,
      created_at,
      submitted_at
    )
    values (
      v_existing.id,
      coalesce(v_existing.ver, 1),
      coalesce(v_existing.ver, 1),
      v_existing.file_url,
      v_existing.notes,
      v_existing.status,
      now(),
      now()
    );

    update public.submissions
    set
      file_url = p_file_url,
      status = v_new_status,
      notes = p_notes,
      is_late = v_is_late,
      version_number = v_new_version,
      version = v_new_version,
      updated_at = now()
    where id = v_existing.id
    returning * into v_result;
  else
    insert into public.submissions (
      assignment_id,
      student_id,
      file_url,
      status,
      notes,
      is_late,
      version_number,
      version,
      created_at,
      updated_at
    )
    values (
      p_assignment_id,
      v_student_id,
      p_file_url,
      v_new_status,
      p_notes,
      v_is_late,
      1,
      1,
      now(),
      now()
    )
    returning * into v_result;
  end if;

  return to_jsonb(v_result);
end;
$$;

grant execute on function public.submit_student_assignment(uuid, text, boolean, text) to authenticated;
