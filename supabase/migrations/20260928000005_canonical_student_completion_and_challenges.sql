-- ==============================================================================
-- supabase/migrations/20260928000005_canonical_student_completion_and_challenges.sql
-- Canonical Migration: Student Lesson Verification, Certificates, Study Reminders,
-- and Daily Challenges Database Persistence
-- ==============================================================================

-- 1. Certificates Table & RLS
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text unique not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  issued_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint unique_student_cohort_cert unique (student_id, cohort_id)
);

create index if not exists idx_certificates_student on public.certificates(student_id);
create index if not exists idx_certificates_cohort on public.certificates(cohort_id);

alter table public.certificates enable row level security;

drop policy if exists "Certificates readable by student and staff" on public.certificates;
create policy "Certificates readable by student and staff"
  on public.certificates for select
  to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.mentor_cohorts mc
      where mc.cohort_id = certificates.cohort_id
        and mc.mentor_id = auth.uid()
    )
  );

-- 2. Student Study Planning Reminders Table & RLS
create table if not exists public.student_study_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  title text not null,
  description text,
  scheduled_at timestamptz not null,
  reminder_type text not null default 'study_block',
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_study_reminders_user_sched
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

-- 3. Ensure Daily Challenges Table and Submissions Table Exist with Correct Policies
create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 30),
  title text not null,
  description text,
  instructions text,
  starter_files_url text,
  track_type text not null default 'general' check (track_type in ('coding', 'non_coding', 'general')),
  submission_type text not null default 'github_pr' check (submission_type in ('github_pr', 'drive_link', 'loom_video', 'text', 'file')),
  deadline_hours integer not null default 24,
  created_at timestamptz not null default now(),
  constraint daily_challenges_cohort_day_unique unique (cohort_id, day_number)
);

create index if not exists idx_daily_challenges_cohort_day on public.daily_challenges(cohort_id, day_number);

create table if not exists public.daily_challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.daily_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_url text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resubmit', 'accepted')),
  score integer check (score between 0 and 100),
  mentor_feedback text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint daily_challenge_submissions_unique unique (challenge_id, user_id)
);

create index if not exists idx_challenge_submissions_user on public.daily_challenge_submissions(user_id);
create index if not exists idx_challenge_submissions_challenge on public.daily_challenge_submissions(challenge_id);
create index if not exists idx_challenge_submissions_status on public.daily_challenge_submissions(status);

alter table public.daily_challenges enable row level security;
alter table public.daily_challenge_submissions enable row level security;

drop policy if exists "Authenticated users can read daily challenges" on public.daily_challenges;
create policy "Authenticated users can read daily challenges"
  on public.daily_challenges for select
  to authenticated
  using (true);

drop policy if exists "Mentors and Admins can manage daily challenges" on public.daily_challenges;
create policy "Mentors and Admins can manage daily challenges"
  on public.daily_challenges for all
  to authenticated
  using (public.is_mentor_or_admin())
  with check (public.is_mentor_or_admin());

drop policy if exists "Students can manage own challenge submissions" on public.daily_challenge_submissions;
create policy "Students can manage own challenge submissions"
  on public.daily_challenge_submissions for all
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_mentor_or_admin()
  )
  with check (
    user_id = auth.uid()
    or public.is_mentor_or_admin()
  );

-- 4. Authoritative Lesson Engagement Validation RPC
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
      watch_percentage = greatest(coalesce(public.lesson_progress.watch_percentage, 0), v_final_watch),
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
      watch_percentage = greatest(coalesce(public.lesson_progress.watch_percentage, 0), v_final_watch),
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

grant execute on function public.verify_and_complete_lesson(uuid, uuid, numeric, numeric) to authenticated;

-- 5. Authoritative Certificate Generation & Verification RPC
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
  v_total_lessons int;
  v_completed_lessons int;
  v_total_assignments int;
  v_approved_assignments int;
  v_existing_cert record;
  v_cert_number text;
  v_new_cert record;
begin
  -- 1. Check enrollment
  select exists (
    select 1 from public.enrollments
    where user_id = p_student_id and cohort_id = p_cohort_id and status in ('active', 'completed', 'enrolled')
  ) into v_enrolled;

  if not v_enrolled then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'Student is not actively enrolled in this cohort.'
    );
  end if;

  -- 2. Count published lessons & completed lessons
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
    and lp.completed = true;

  if v_total_lessons > 0 and v_completed_lessons < v_total_lessons then
    return jsonb_build_object(
      'eligible', false,
      'reason', format('Only %s of %s lessons completed. 100%% curriculum completion is required.', v_completed_lessons, v_total_lessons),
      'completed_lessons', v_completed_lessons,
      'total_lessons', v_total_lessons
    );
  end if;

  -- 3. Count assignments and approved submissions
  select count(id)
  into v_total_assignments
  from public.assignments
  where cohort_id = p_cohort_id;

  select count(distinct s.assignment_id)
  into v_approved_assignments
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.student_id = p_student_id
    and a.cohort_id = p_cohort_id
    and s.status = 'reviewed';

  if v_total_assignments > 0 and v_approved_assignments < v_total_assignments then
    return jsonb_build_object(
      'eligible', false,
      'reason', format('Only %s of %s assignments approved by mentor.', v_approved_assignments, v_total_assignments),
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
      'total_lessons', v_total_lessons,
      'total_assignments', v_total_assignments,
      'verified_by', 'system'
    )
  )
  returning * into v_new_cert;

  -- Update enrollment status to completed
  update public.enrollments
  set status = 'completed'
  where user_id = p_student_id and cohort_id = p_cohort_id;

  return jsonb_build_object(
    'eligible', true,
    'already_issued', false,
    'certificate_number', v_new_cert.certificate_number,
    'issued_at', v_new_cert.issued_at,
    'completed_lessons', v_completed_lessons,
    'total_lessons', v_total_lessons,
    'approved_assignments', v_approved_assignments,
    'total_assignments', v_total_assignments
  );
end;
$$;

grant execute on function public.verify_and_issue_certificate(uuid, uuid) to authenticated;

-- 6. Canonical Seed Function for 15-Day Challenges per Cohort
create or replace function public.ensure_cohort_daily_challenges(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.daily_challenges
  where cohort_id = p_cohort_id;

  if v_count >= 15 then
    return jsonb_build_object('success', true, 'count', v_count, 'seeded', false);
  end if;

  insert into public.daily_challenges (
    cohort_id,
    day_number,
    title,
    description,
    instructions,
    starter_files_url,
    track_type,
    submission_type,
    deadline_hours
  )
  values
    (p_cohort_id, 1, 'Day 01: Production Setup & First Kinetic Cut', 'Establish project directory structure, import raw footage/starter repo, and ship first edit.', 'Submit your Day 1 repository PR or Google Drive cut link before midnight.', 'https://drive.google.com/drive/folders/sample-day-1', 'general', 'drive_link', 24),
    (p_cohort_id, 2, 'Day 02: Pacing, Micro-Transitions & Retention', 'Learn fast-paced cuts, J/L audio cuts, and maintaining 70%+ audience watch retention.', 'Produce a 30-second timeline maintaining retention peaks at seconds 3, 7, and 15.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 3, 'Day 03: Sound Design, SFX Stems & Audio Layering', 'Layer whooshes, risers, foley hits, and balance speech volume levels to -6dB True Peak.', 'Include at least 4 distinct audio stem layers and export your clean WAV/MP4 master.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 4, 'Day 04: Kinetic Typography & Motion Graphics', 'Sync word-by-word highlighted captions and title lower-thirds to voice cadence.', 'Submit a 45-second commercial segment featuring dynamic kinetic typography.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 5, 'Day 05: Sprint 1 Milestone — First Client Simulation', 'Integrate Days 1–4 techniques into a complete 60s vertical product ad or full code module.', 'Submit your Sprint 1 final export for weekend mentor live grading.', null, 'general', 'drive_link', 48),
    (p_cohort_id, 6, 'Day 06: Cinematic Color Grading & Tone Curves', 'Color balance Log footage, create a moody contrast curve, and export Rec.709 clean grades.', 'Submit a side-by-side Before/After color comparison video.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 7, 'Day 07: Speed Ramping, Optical Flow & Match Cuts', 'Execute smooth seamless speed-ramps between action sequences using bezier handles.', 'Deliver a 20-second dynamic sports or fitness montage with 3 speed ramps.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 8, 'Day 08: Visual FX, Green Screen & Rotoscoping', 'Mask foreground subjects, layer background lighting effects, and clean edge bleed.', 'Submit your composite shot file and render proof.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 9, 'Day 09: Music Video Rhythm & Beat Synchronicity', 'Cut to dynamic tempo shifts and transient drum peaks for maximum emotional punch.', 'Sync 8 fast-cut b-roll scenes to acoustic/electronic tempo drop.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 10, 'Day 10: Sprint 2 Milestone — Mid-Term Portfolio Review', 'Consolidated commercial cut incorporating color, sound, typography, and speed ramps.', 'Submit for mid-term mentor feedback audit and cohort leaderboard score.', null, 'general', 'drive_link', 48),
    (p_cohort_id, 11, 'Day 11: Production Capstone — Storyboard & Raw Assembly', 'Begin your final 15-day capstone client project. Assemble the A-roll timeline.', 'Submit rough narrative sequence cut.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 12, 'Day 12: Production Capstone — Sound Design & Foley Polish', 'Add music transitions, SFX sweetening, and vocal clarity EQ pass.', 'Submit second cut with completed audio stems.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 13, 'Day 13: Production Capstone — Motion & Color Mastering', 'Fine-tune color consistency across all takes, add typography overlays, and sharpen details.', 'Submit near-final client master for preliminary mentor critique.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 14, 'Day 14: Final Capstone Master Export & Showcase', 'Deliver the client-ready 4K and vertical master exports with complete source project bundle.', 'Submit high-bitrate export link along with written production notes.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 15, 'Day 15: Graduation, Exit Evaluation & Letter of Recommendation', 'Final mentor grading, portfolio verification, and release of your verified Internship Certificate.', 'Complete the exit survey and claim your verifiable digital certificate.', null, 'general', 'text', 24)
  on conflict (cohort_id, day_number) do nothing;

  select count(*) into v_count
  from public.daily_challenges
  where cohort_id = p_cohort_id;

  return jsonb_build_object('success', true, 'count', v_count, 'seeded', true);
end;
$$;

grant execute on function public.ensure_cohort_daily_challenges(uuid) to authenticated;
