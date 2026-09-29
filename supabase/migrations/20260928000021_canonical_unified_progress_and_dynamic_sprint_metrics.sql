-- ==============================================================================
-- Migration 26: Canonical Unified Progress & Dynamic Sprint Metrics
-- File: supabase/migrations/20260928000021_canonical_unified_progress_and_dynamic_sprint_metrics.sql
--
-- AUDIT RESOLUTION:
-- Solves Progress Tracking audit findings:
-- 1. "Sprint metrics use fixed assumptions": Eliminates hardcoded 15-day sprint duration
--    and makes sprint metrics dynamically adapt to cohort.sprint_duration_days and
--    the actual challenge days defined in the curriculum.
-- 2. "challenge and course progress are separate": Unifies curriculum lesson watch
--    progress, assignment submissions, and daily challenge milestones into a single
--    authoritative database telemetry RPC (get_student_unified_progress).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Enhancements & Dynamic Sprint Configuration
-- ------------------------------------------------------------------------------
alter table public.cohorts
  add column if not exists sprint_duration_days integer not null default 15;

-- Performance indexes for progress rollups
create index if not exists idx_cohorts_sprint_duration on public.cohorts(id, sprint_duration_days);
create index if not exists idx_lessons_module_id on public.lessons(module_id);
create index if not exists idx_modules_cohort_id on public.modules(cohort_id);
create index if not exists idx_assignments_cohort_id on public.assignments(cohort_id);
create index if not exists idx_submissions_student_assignment on public.submissions(student_id, assignment_id, status);
create index if not exists idx_daily_challenges_cohort_day on public.daily_challenges(cohort_id, day_number);
create index if not exists idx_daily_challenge_subs_user_status on public.daily_challenge_submissions(user_id, status, score);

-- ------------------------------------------------------------------------------
-- 2. Authoritative Unified Progress RPC: get_student_unified_progress
-- ------------------------------------------------------------------------------
create or replace function public.get_student_unified_progress(
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
  v_enrollment_status text;

  -- Curriculum
  v_total_lessons int := 0;
  v_completed_lessons int := 0;
  v_total_watch_seconds bigint := 0;
  v_curriculum_percent int := 0;

  -- Assignments
  v_total_assignments int := 0;
  v_submitted_assignments int := 0;
  v_approved_assignments int := 0;
  v_assignment_percent int := 0;

  -- Sprint Challenges
  v_cohort_sprint_days int := 15;
  v_max_challenge_day int := 0;
  v_total_challenges int := 0;
  v_effective_sprint_days int := 15;
  v_submitted_challenges int := 0;
  v_completed_challenges int := 0;
  v_sprint_percent int := 0;
  v_avg_score numeric := null;
  v_streak_days int := 0;

  -- Overall Composite
  v_total_milestones int := 0;
  v_completed_milestones int := 0;
  v_composite_percent int := 0;
  v_eligible_for_cert boolean := false;
  v_has_certificate boolean := false;
  v_cert_record record;
begin
  -- 1. Verify enrollment and staff authorization
  select exists(
    select 1 from public.enrollments
    where user_id = p_student_id and cohort_id = p_cohort_id
  ), coalesce(
    (select status from public.enrollments where user_id = p_student_id and cohort_id = p_cohort_id limit 1),
    'none'
  )
  into v_enrolled, v_enrollment_status;

  -- Allow student to inspect their own progress, or staff (mentor/admin)
  if not (auth.uid() = p_student_id or public.is_mentor_or_admin()) then
    raise exception 'Unauthorized to inspect student progress' using errcode = '42501';
  end if;

  -- 2. Fetch Cohort Sprint Configuration
  select coalesce(sprint_duration_days, 15)
  into v_cohort_sprint_days
  from public.cohorts
  where id = p_cohort_id;

  if v_cohort_sprint_days is null then
    v_cohort_sprint_days := 15;
  end if;

  -- 3. Calculate Curriculum Metrics
  select count(l.id)
  into v_total_lessons
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where m.cohort_id = p_cohort_id;

  select
    count(distinct lp.lesson_id),
    coalesce(sum(coalesce(lp.watched_seconds, 0)), 0)
  into v_completed_lessons, v_total_watch_seconds
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  join public.modules m on m.id = l.module_id
  where lp.user_id = p_student_id
    and m.cohort_id = p_cohort_id
    and lp.completed = true;

  if v_total_lessons > 0 then
    v_curriculum_percent := round((v_completed_lessons::numeric / v_total_lessons::numeric) * 100);
  else
    v_curriculum_percent := 0;
  end if;

  -- 4. Calculate Assignment Metrics
  select count(a.id)
  into v_total_assignments
  from public.assignments a
  where a.cohort_id = p_cohort_id;

  select
    count(distinct s.assignment_id),
    count(distinct case when s.status = 'reviewed' then s.assignment_id end)
  into v_submitted_assignments, v_approved_assignments
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.student_id = p_student_id
    and a.cohort_id = p_cohort_id;

  if v_total_assignments > 0 then
    v_assignment_percent := round((v_approved_assignments::numeric / v_total_assignments::numeric) * 100);
  else
    v_assignment_percent := 0;
  end if;

  -- 5. Calculate Sprint & Challenge Metrics
  select
    count(dc.id),
    coalesce(max(dc.day_number), 0)
  into v_total_challenges, v_max_challenge_day
  from public.daily_challenges dc
  where dc.cohort_id = p_cohort_id;

  -- Effective sprint days is the maximum of the configured cohort duration,
  -- highest challenge day number, or actual count of challenges.
  v_effective_sprint_days := greatest(v_cohort_sprint_days, v_max_challenge_day, v_total_challenges, 1);

  select
    count(distinct dcs.challenge_id),
    count(distinct case when dcs.status = 'accepted' then dcs.challenge_id end),
    avg(dcs.score)
  into v_submitted_challenges, v_completed_challenges, v_avg_score
  from public.daily_challenge_submissions dcs
  join public.daily_challenges dc on dc.id = dcs.challenge_id
  where dcs.user_id = p_student_id
    and dc.cohort_id = p_cohort_id;

  if v_effective_sprint_days > 0 then
    v_sprint_percent := round((v_completed_challenges::numeric / v_effective_sprint_days::numeric) * 100);
  else
    v_sprint_percent := 0;
  end if;

  -- Dynamic streak calculation capped to effective sprint days
  v_streak_days := least(v_completed_challenges, v_effective_sprint_days);

  -- 6. Calculate Unified Composite Progress
  -- Sum total active milestones across curriculum, assignments, and challenges
  v_total_milestones := v_total_lessons + v_total_assignments + (
    case when v_total_challenges > 0 then v_effective_sprint_days else 0 end
  );

  v_completed_milestones := v_completed_lessons + v_approved_assignments + (
    case when v_total_challenges > 0 then v_completed_challenges else 0 end
  );

  if v_total_milestones > 0 then
    v_composite_percent := least(100, round((v_completed_milestones::numeric / v_total_milestones::numeric) * 100));
  else
    v_composite_percent := 0;
  end if;

  -- 7. Check Certificate Status & Eligibility
  select * from public.certificates
  where student_id = p_student_id and cohort_id = p_cohort_id
  into v_cert_record;

  v_has_certificate := (v_cert_record.id is not null);

  v_eligible_for_cert := (
    v_enrolled
    and (v_total_lessons = 0 or v_completed_lessons >= v_total_lessons)
    and (v_total_assignments = 0 or v_approved_assignments >= v_total_assignments)
    and (v_total_challenges = 0 or v_completed_challenges >= v_effective_sprint_days)
  );

  return jsonb_build_object(
    'student_id', p_student_id,
    'cohort_id', p_cohort_id,
    'enrollment', jsonb_build_object(
      'is_enrolled', v_enrolled,
      'status', v_enrollment_status
    ),
    'curriculum', jsonb_build_object(
      'total_lessons', v_total_lessons,
      'completed_lessons', v_completed_lessons,
      'percent', v_curriculum_percent,
      'total_watch_seconds', v_total_watch_seconds
    ),
    'assignments', jsonb_build_object(
      'total_assignments', v_total_assignments,
      'submitted_assignments', v_submitted_assignments,
      'approved_assignments', v_approved_assignments,
      'percent', v_assignment_percent
    ),
    'sprint_challenges', jsonb_build_object(
      'configured_sprint_days', v_cohort_sprint_days,
      'effective_sprint_days', v_effective_sprint_days,
      'total_challenges', v_total_challenges,
      'submitted_challenges', v_submitted_challenges,
      'completed_challenges', v_completed_challenges,
      'percent', v_sprint_percent,
      'streak_days', v_streak_days,
      'average_score', case when v_avg_score is not null then round(v_avg_score) else null end
    ),
    'overall', jsonb_build_object(
      'composite_percent', v_composite_percent,
      'total_milestones', v_total_milestones,
      'completed_milestones', v_completed_milestones,
      'is_completed', (v_composite_percent >= 100),
      'eligible_for_certificate', v_eligible_for_cert,
      'has_certificate', v_has_certificate,
      'certificate_number', v_cert_record.certificate_number,
      'certificate_issued_at', v_cert_record.issued_at
    )
  );
end;
$$;

grant execute on function public.get_student_unified_progress(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. Enhance verify_and_issue_certificate with Unified Sprint Verification
-- ------------------------------------------------------------------------------
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
  v_cohort_sprint_days int;
  v_total_challenges int;
  v_effective_sprint_days int;
  v_completed_challenges int;
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

  -- 4. Count Sprint Challenges (Unified Sprint Milestone Verification)
  select coalesce(sprint_duration_days, 15)
  into v_cohort_sprint_days
  from public.cohorts
  where id = p_cohort_id;

  select count(dc.id)
  into v_total_challenges
  from public.daily_challenges dc
  where dc.cohort_id = p_cohort_id;

  v_effective_sprint_days := greatest(coalesce(v_cohort_sprint_days, 15), v_total_challenges, 1);

  if v_total_challenges > 0 then
    select count(distinct dcs.challenge_id)
    into v_completed_challenges
    from public.daily_challenge_submissions dcs
    join public.daily_challenges dc on dc.id = dcs.challenge_id
    where dcs.user_id = p_student_id
      and dc.cohort_id = p_cohort_id
      and dcs.status = 'accepted';

    if v_completed_challenges < v_effective_sprint_days then
      return jsonb_build_object(
        'eligible', false,
        'reason', format('Only %s of %s sprint challenges completed and accepted.', v_completed_challenges, v_effective_sprint_days),
        'completed_challenges', v_completed_challenges,
        'total_challenges', v_effective_sprint_days
      );
    end if;
  end if;

  -- 5. Check if certificate already issued
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
      'total_assignments', v_total_assignments,
      'completed_challenges', coalesce(v_completed_challenges, 0),
      'total_challenges', v_effective_sprint_days
    );
  end if;

  -- 6. Issue new authoritative certificate
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
      'total_challenges', v_effective_sprint_days,
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
    'total_assignments', v_total_assignments,
    'completed_challenges', coalesce(v_completed_challenges, 0),
    'total_challenges', v_effective_sprint_days
  );
end;
$$;

grant execute on function public.verify_and_issue_certificate(uuid, uuid) to authenticated;
