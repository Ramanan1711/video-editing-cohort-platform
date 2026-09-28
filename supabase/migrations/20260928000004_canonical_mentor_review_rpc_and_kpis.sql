-- ==============================================================================
-- supabase/migrations/20260928000004_canonical_mentor_review_rpc_and_kpis.sql
-- Canonical Migration: Mentor Review RPCs (v1 & v2), Cohort Scoping & KPI Schema
-- ==============================================================================

-- 1. Ensure submissions table has required columns and flexible status checks
alter table public.submissions
  add column if not exists sla_target_hours integer not null default 24,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_reason text,
  add column if not exists escalated_by uuid,
  add column if not exists private_notes text;

create index if not exists idx_submissions_escalated on public.submissions(escalated_at) where escalated_at is not null;

-- Update status check to accept both 'resubmit' and 'resubmit_requested'
do $$
begin
  alter table public.submissions drop constraint if exists submissions_status_check;
  alter table public.submissions add constraint submissions_status_check
    check (status in ('draft', 'pending', 'reviewed', 'resubmit', 'resubmit_requested'));
exception
  when others then null;
end $$;

-- 2. Ensure feedback table has comments and comment columns, rubric, timestamps, and dual-column compatibility
alter table public.feedback
  add column if not exists comments text,
  add column if not exists comment text,
  add column if not exists rubric jsonb not null default '{}'::jsonb,
  add column if not exists rubric_scores jsonb default '{}'::jsonb,
  add column if not exists timestamped_notes jsonb not null default '[]'::jsonb,
  add column if not exists private_notes text;

-- Safely drop NOT NULL on comment/comments if present
do $$
begin
  alter table public.feedback alter column comment drop not null;
exception
  when others then null;
end $$;

do $$
begin
  alter table public.feedback alter column comments drop not null;
exception
  when others then null;
end $$;

-- 3. Ensure mentor_office_hours table and indexes exist
create table if not exists public.mentor_office_hours (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  title text not null,
  meeting_url text not null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30,
  booked_by uuid references public.profiles(id) on delete set null,
  status text not null default 'available' check (status in ('available', 'booked', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_mentor_office_hours_mentor on public.mentor_office_hours(mentor_id);
create index if not exists idx_mentor_office_hours_cohort on public.mentor_office_hours(cohort_id);

alter table public.mentor_office_hours enable row level security;

drop policy if exists "Office hours readable by cohort students and mentors" on public.mentor_office_hours;
create policy "Office hours readable by cohort students and mentors"
  on public.mentor_office_hours for select
  to authenticated
  using (
    mentor_id = auth.uid()
    or public.is_admin()
    or (
      cohort_id is not null and exists (
        select 1 from public.enrollments e
        where e.user_id = auth.uid() and e.cohort_id = mentor_office_hours.cohort_id
      )
    )
  );

drop policy if exists "Mentors can manage own office hours" on public.mentor_office_hours;
create policy "Mentors can manage own office hours"
  on public.mentor_office_hours for all
  to authenticated
  using (
    mentor_id = auth.uid()
    or public.is_admin()
  )
  with check (
    mentor_id = auth.uid()
    or public.is_admin()
  );

-- 4. Cohort Assignment Authorization Helpers
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
      and coalesce(p.status, 'active') = 'active'
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
      and coalesce(p.status, 'active') = 'active'
      and (
        p.role = 'admin'
        or (
          p.role = 'mentor'
          and (
            exists (
              select 1
              from public.submissions s
              join public.assignments a on a.id = s.assignment_id
              join public.mentor_cohorts mc on mc.cohort_id = a.cohort_id
              where s.id = p_submission_id
                and mc.mentor_id = auth.uid()
            )
            or exists (
              select 1
              from public.submissions s
              join public.enrollments e on e.user_id = s.student_id
              join public.mentor_cohorts mc on mc.cohort_id = e.cohort_id
              where s.id = p_submission_id
                and mc.mentor_id = auth.uid()
            )
          )
        )
      )
  );
$$;

-- 5. Canonical Atomic Review RPC v2 (review_submission_v2)
create or replace function public.review_submission_v2(
  p_submission_id uuid,
  p_status text,
  p_comments text default null,
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
  v_student_id uuid;
  v_normalized_status text;
  v_is_assigned boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required: You must be logged in';
  end if;

  -- Validate role and active status
  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role in ('mentor', 'admin')
      and coalesce(status, 'active') = 'active'
  ) then
    raise exception 'Access denied: Only active mentors or administrators can review submissions';
  end if;

  -- Normalize status ('reviewed', 'resubmit', 'resubmit_requested')
  v_normalized_status := lower(trim(p_status));
  if v_normalized_status = 'resubmit_requested' then
    v_normalized_status := 'resubmit';
  end if;

  if v_normalized_status not in ('reviewed', 'resubmit') then
    raise exception 'Invalid review status: Status must be "reviewed" or "resubmit"';
  end if;

  -- Verify submission exists and fetch student_id
  select student_id into v_student_id
  from public.submissions
  where id = p_submission_id;

  if v_student_id is null then
    raise exception 'Submission not found';
  end if;

  -- Verify cohort assignment
  v_is_assigned := public.is_mentor_assigned_to_submission(p_submission_id);
  if not v_is_assigned then
    raise exception 'Access denied: You are not assigned to mentor the cohort for this submission';
  end if;

  -- Record feedback entry (dual-column compatibility for comments and rubric)
  insert into public.feedback (
    submission_id,
    mentor_id,
    comment,
    comments,
    rubric,
    rubric_scores,
    timestamped_notes,
    private_notes
  )
  values (
    p_submission_id,
    v_user_id,
    coalesce(trim(p_comments), ''),
    coalesce(trim(p_comments), ''),
    coalesce(p_rubric, '{}'::jsonb),
    coalesce(p_rubric, '{}'::jsonb),
    coalesce(p_timestamped_notes, '[]'::jsonb),
    p_private_notes
  );

  -- Update submission status and private note
  update public.submissions
  set
    status = v_normalized_status,
    private_notes = coalesce(p_private_notes, private_notes),
    updated_at = now()
  where id = p_submission_id;

  -- Insert student notification (fail-safe)
  begin
    insert into public.notifications (
      user_id,
      title,
      body,
      category,
      action_url
    )
    values (
      v_student_id,
      case when v_normalized_status = 'reviewed' then 'Assignment Approved!' else 'Revision Requested' end,
      case when v_normalized_status = 'reviewed'
        then 'Your mentor has reviewed and approved your submission.'
        else 'Your mentor reviewed your submission and requested revisions.'
      end,
      'assignment',
      '/assignments'
    );
  exception
    when others then
      null;
  end;
end;
$$;

grant execute on function public.review_submission_v2(uuid, text, text, jsonb, jsonb, text) to authenticated;

-- 6. Canonical Backward-Compatible Review RPC (review_submission)
create or replace function public.review_submission(
  p_submission_id uuid,
  p_status text,
  p_comments text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.review_submission_v2(
    p_submission_id => p_submission_id,
    p_status => p_status,
    p_comments => p_comments,
    p_rubric => '{}'::jsonb,
    p_timestamped_notes => '[]'::jsonb,
    p_private_notes => null
  );
end;
$$;

grant execute on function public.review_submission(uuid, text, text) to authenticated;
