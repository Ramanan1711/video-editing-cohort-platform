-- supabase/mentor_workspace_enhancements.sql
-- Comprehensive Mentor Flow & Workspace Enhancements
--
-- Enables:
-- 1. Mentor-to-Cohort assignments table (mentor_cohorts)
-- 2. Structured feedback (rubric scoring, timestamped video notes, private staff notes)
-- 3. Review SLA tracking and escalation to admin on submissions
-- 4. Mentor office hours scheduling
-- 5. Direct mentor-student communications

-- ==============================================================================
-- 1. Mentor Cohorts Table & RLS Policies
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

-- Read policy: mentors can read their own assignments, and admins can read all
drop policy if exists "Mentors can read own assignments and admins can read all" on public.mentor_cohorts;
create policy "Mentors can read own assignments and admins can read all"
  on public.mentor_cohorts for select
  to authenticated
  using (
    mentor_id = auth.uid()
    or public.is_admin()
  );

-- Admin management policy: admins can assign and unassign mentors
drop policy if exists "Admins have full management on mentor_cohorts" on public.mentor_cohorts;
create policy "Admins have full management on mentor_cohorts"
  on public.mentor_cohorts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ==============================================================================
-- 2. Enhanced Submissions Table (SLA, Escalation, Private Notes)
-- ==============================================================================
alter table public.submissions
  add column if not exists sla_target_hours integer not null default 24,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_reason text,
  add column if not exists escalated_by uuid references auth.users(id),
  add column if not exists private_notes text;

create index if not exists idx_submissions_escalated on public.submissions(escalated_at) where escalated_at is not null;

-- ==============================================================================
-- 3. Enhanced Feedback Table (Rubric, Timestamped Notes, Private Notes)
-- ==============================================================================
alter table public.feedback
  add column if not exists rubric jsonb not null default '{}'::jsonb,
  add column if not exists timestamped_notes jsonb not null default '[]'::jsonb,
  add column if not exists private_notes text;

-- ==============================================================================
-- 4. Mentor Office Hours Table & RLS
-- ==============================================================================
create table if not exists public.mentor_office_hours (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references auth.users(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  title text not null,
  meeting_url text not null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30,
  booked_by uuid references auth.users(id),
  status text not null default 'available' check (status in ('available', 'booked', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_mentor_office_hours_mentor on public.mentor_office_hours(mentor_id);
create index if not exists idx_mentor_office_hours_cohort on public.mentor_office_hours(cohort_id);

alter table public.mentor_office_hours enable row level security;

-- Read policy: mentors can read their own slots, students in cohort or admins can read
drop policy if exists "Office hours readable by cohort students and mentors" on public.mentor_office_hours;
create policy "Office hours readable by cohort students and mentors"
  on public.mentor_office_hours for select
  to authenticated
  using (
    mentor_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.enrollments e
      where e.user_id = auth.uid() and e.cohort_id = mentor_office_hours.cohort_id
    )
  );

-- Mentor management policy
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

-- ==============================================================================
-- 5. Mentor Direct Messages Table & RLS
-- ==============================================================================
create table if not exists public.mentor_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_mentor_messages_participants on public.mentor_messages(sender_id, recipient_id);
create index if not exists idx_mentor_messages_submission on public.mentor_messages(submission_id);

alter table public.mentor_messages enable row level security;

drop policy if exists "Users can read messages they sent or received" on public.mentor_messages;
create policy "Users can read messages they sent or received"
  on public.mentor_messages for select
  to authenticated
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "Users can insert messages as sender" on public.mentor_messages;
create policy "Users can insert messages as sender"
  on public.mentor_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
  );

-- ==============================================================================
-- 6. Atomic Review RPC v2 (with Rubric, Timestamps & Private Notes)
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
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'You must be logged in';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role in ('mentor', 'admin')
  ) then
    raise exception 'Only mentors or admins can review submissions';
  end if;

  if p_status not in ('reviewed', 'resubmit') then
    raise exception 'Invalid review status';
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

