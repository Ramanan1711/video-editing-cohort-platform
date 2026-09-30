-- ==============================================================================
-- supabase/student_flow_validation.sql
-- Student Flow Engagement Hardening, Progress Validation, Study Planning,
-- Unread Feedback Tracking, and Authoritative Certificate Verification
-- ==============================================================================

-- 1. Unread Feedback Tracking on Submissions
alter table public.feedback
  add column if not exists student_read_at timestamptz default null;

create index if not exists idx_feedback_student_unread
  on public.feedback(submission_id, student_read_at);

-- RPC to mark feedback as read by the student
create or replace function public.mark_feedback_as_read(
  p_feedback_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.feedback
  set student_read_at = now()
  where id = p_feedback_id
    and exists (
      select 1 from public.submissions s
      where s.id = feedback.submission_id
        and s.student_id = auth.uid()
    );
end;
$$;

-- 2. Persistent Student Study Reminders & Planning Table
create table if not exists public.student_study_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  title text not null,
  description text,
  scheduled_at timestamptz not null,
  reminder_type text not null default 'study_block', -- 'study_block', 'assignment_deadline', 'review_prep'
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_study_reminders_user_date
  on public.student_study_reminders(user_id, scheduled_at);

create index if not exists idx_study_reminders_cohort
  on public.student_study_reminders(cohort_id);

alter table public.student_study_reminders enable row level security;

drop policy if exists "Students can manage own study reminders" on public.student_study_reminders;
create policy "Students can manage own study reminders"
  on public.student_study_reminders for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. Authoritative Lesson Engagement Validation RPC
-- Ensures that lessons with videos cannot be marked complete unless watch_percentage >= 80
create or replace function public.verify_and_complete_lesson(
  p_user_id uuid,
  p_lesson_id uuid,
  p_watch_percentage numeric default 0,
  p_position_seconds numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_video boolean;
  v_is_eligible boolean := false;
  v_existing_completed boolean := false;
  v_final_watch numeric := p_watch_percentage;
begin
  -- Verify caller is the student themselves or staff
  if auth.uid() != p_user_id and not exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'mentor')
  ) then
    return jsonb_build_object('success', false, 'reason', 'Unauthorized user operation.');
  end if;

  -- Check if lesson has video content
  select (video_url is not null and trim(video_url) != '')
  into v_has_video
  from public.lessons
  where id = p_lesson_id;

  -- Check existing progress
  select completed, watch_percentage
  into v_existing_completed, v_final_watch
  from public.lesson_progress
  where user_id = p_user_id and lesson_id = p_lesson_id;

  if v_final_watch is null or p_watch_percentage > v_final_watch then
    v_final_watch := p_watch_percentage;
  end if;

  if v_existing_completed then
    v_is_eligible := true;
  elsif not v_has_video then
    -- Text/reading lesson without video: eligible immediately
    v_is_eligible := true;
  elsif v_final_watch >= 80 then
    -- 80% video watch engagement threshold satisfied
    v_is_eligible := true;
  else
    v_is_eligible := false;
  end if;

  if v_is_eligible then
    insert into public.lesson_progress (user_id, lesson_id, completed, completed_at, watch_percentage, last_position_seconds)
    values (p_user_id, p_lesson_id, true, now(), v_final_watch, p_position_seconds)
    on conflict (user_id, lesson_id)
    do update set
      completed = true,
      completed_at = coalesce(public.lesson_progress.completed_at, now()),
      watch_percentage = greatest(public.lesson_progress.watch_percentage, v_final_watch),
      last_position_seconds = p_position_seconds;

    return jsonb_build_object(
      'success', true,
      'completed', true,
      'watch_percentage', v_final_watch,
      'verified', true
    );
  else
    -- Update watch progress but refuse completion
    insert into public.lesson_progress (user_id, lesson_id, completed, watch_percentage, last_position_seconds)
    values (p_user_id, p_lesson_id, false, v_final_watch, p_position_seconds)
    on conflict (user_id, lesson_id)
    do update set
      watch_percentage = greatest(public.lesson_progress.watch_percentage, v_final_watch),
      last_position_seconds = p_position_seconds;

    return jsonb_build_object(
      'success', false,
      'completed', false,
      'watch_percentage', v_final_watch,
      'reason', format('You have watched %s%% of the video. At least 80%% is required to verify lesson completion.', round(v_final_watch))
    );
  end if;
end;
$$;

-- 4. Fortified Authoritative Certificate Verification RPC
-- Correctly handles assignment lookup across modules/lessons and validates 80%+ engagement
create or replace function public.verify_and_issue_certificate(
  p_student_id uuid,
  p_cohort_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrolled boolean;
  v_total_lessons int := 0;
  v_completed_lessons int := 0;
  v_total_assignments int := 0;
  v_approved_assignments int := 0;
  v_existing_cert record;
  v_cert_number text;
begin
  -- 1. Check active enrollment
  select exists (
    select 1 from public.enrollments
    where user_id = p_student_id and cohort_id = p_cohort_id and status in ('active', 'completed')
  ) into v_enrolled;

  if not v_enrolled then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'Student is not actively enrolled in this cohort.'
    );
  end if;

  -- 2. Count published lessons & verified completed lessons (80%+ watch rate for video lessons)
  select count(l.id)
  into v_total_lessons
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where m.cohort_id = p_cohort_id;

  select count(distinct lp.lesson_id)
  into v_completed_lessons
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  join public.modules m on m.id = l.module_id
  where lp.user_id = p_student_id
    and m.cohort_id = p_cohort_id
    and lp.completed = true
    and (l.video_url is null or trim(l.video_url) = '' or lp.watch_percentage >= 80);

  if v_total_lessons > 0 and v_completed_lessons < v_total_lessons then
    return jsonb_build_object(
      'eligible', false,
      'reason', format('Only %s of %s curriculum lessons verified complete (≥80%% watch rate required).', v_completed_lessons, v_total_lessons),
      'completed_lessons', v_completed_lessons,
      'total_lessons', v_total_lessons
    );
  end if;

  -- 3. Count assignments and approved submissions via lesson_id hierarchy
  select count(distinct a.id)
  into v_total_assignments
  from public.assignments a
  join public.lessons l on l.id = a.lesson_id
  join public.modules m on m.id = l.module_id
  where m.cohort_id = p_cohort_id;

  select count(distinct s.assignment_id)
  into v_approved_assignments
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.lessons l on l.id = a.lesson_id
  join public.modules m on m.id = l.module_id
  where s.student_id = p_student_id
    and m.cohort_id = p_cohort_id
    and s.status = 'reviewed';

  if v_total_assignments > 0 and v_approved_assignments < v_total_assignments then
    return jsonb_build_object(
      'eligible', false,
      'reason', format('Only %s of %s assignments have been reviewed and approved by mentors.', v_approved_assignments, v_total_assignments),
      'approved_assignments', v_approved_assignments,
      'total_assignments', v_total_assignments
    );
  end if;

  -- 4. Check if certificate already issued
  select * from public.certificates
  where student_id = p_student_id and cohort_id = p_cohort_id
  into v_existing_cert;

  if v_existing_cert.id is not null then
    return jsonb_build_object(
      'eligible', true,
      'already_issued', true,
      'certificate_number', v_existing_cert.certificate_number,
      'issued_at', v_existing_cert.issued_at,
      'completed_lessons', v_completed_lessons,
      'total_lessons', v_total_lessons,
      'approved_assignments', v_approved_assignments,
      'total_assignments', v_total_assignments
    );
  end if;

  -- 5. Issue new authoritative certificate
  v_cert_number := 'CC-' || to_char(now(), 'YYYYMM') || '-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

  insert into public.certificates (certificate_number, student_id, cohort_id, issued_at, metadata)
  values (
    v_cert_number,
    p_student_id,
    p_cohort_id,
    now(),
    jsonb_build_object(
      'completed_lessons', v_completed_lessons,
      'total_lessons', v_total_lessons,
      'approved_assignments', v_approved_assignments,
      'total_assignments', v_total_assignments,
      'verified_at', now()
    )
  );

  return jsonb_build_object(
    'eligible', true,
    'already_issued', false,
    'certificate_number', v_cert_number,
    'issued_at', now(),
    'completed_lessons', v_completed_lessons,
    'total_lessons', v_total_lessons,
    'approved_assignments', v_approved_assignments,
    'total_assignments', v_total_assignments
  );
end;
$$;

