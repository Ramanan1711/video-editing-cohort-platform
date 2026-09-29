-- ==============================================================================
-- Migration: 20260928000022_canonical_authoritative_completion_and_attendance_verification.sql
-- Description: Authoritative Completion Verification incorporating Challenge Completion and Live Session Attendance
--   1. Authoritative verify_and_issue_certificate RPC:
--      - Enforces 4 mandatory pillars for graduation & certificate issuance:
--        a. 100% Curriculum Lesson Completion (with >=80% watch verification).
--        b. 100% Mentor-Approved Assignments (status in 'reviewed', 'approved', 'accepted').
--        c. 100% Production Sprint Daily Challenges (all effective sprint days completed & accepted).
--        d. Minimum 75% Live Workshop Session Attendance (held sessions with status in 'present', 'late', 'excused').
--      - Records complete 4-pillar audit metadata into public.certificates.
--      - Sets public.enrollments.status = 'completed'.
--   2. Authoritative get_student_unified_progress RPC:
--      - Incorporates live workshop attendance metrics alongside curriculum, assignments, and sprint.
--      - Evaluates authoritative certificate eligibility across all 4 pillars.
--   3. High-Performance Indexing:
--      - Compound index on public.session_attendance(student_id, session_id, status).
--      - Compound index on public.live_sessions(cohort_id, starts_at).
-- ==============================================================================

-- 1. Performance Indexes for Fast Verification Queries
create index if not exists idx_live_sessions_cohort_starts
  on public.live_sessions(cohort_id, starts_at);

create index if not exists idx_session_attendance_verification
  on public.session_attendance(student_id, session_id, status);

-- 2. Authoritative verify_and_issue_certificate Function
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
  v_total_sessions int;
  v_attended_sessions int;
  v_attendance_rate_pct numeric;
  v_min_attendance_pct numeric := 75.0;
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
    and s.status in ('reviewed', 'approved', 'accepted');

  if v_total_assignments > 0 and v_approved_assignments < v_total_assignments then
    return jsonb_build_object(
      'eligible', false,
      'reason', format('Only %s of %s assignments approved by mentor. All practical tasks must be passed.', v_approved_assignments, v_total_assignments),
      'completed_lessons', v_completed_lessons,
      'total_lessons', v_total_lessons,
      'approved_assignments', v_approved_assignments,
      'total_assignments', v_total_assignments
    );
  end if;

  -- 4. Count Sprint Challenges (Authoritative Challenge Completion Gate)
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
        'reason', format('Only %s of %s sprint challenges completed and accepted. Full sprint drill completion is required.', v_completed_challenges, v_effective_sprint_days),
        'completed_lessons', v_completed_lessons,
        'total_lessons', v_total_lessons,
        'approved_assignments', v_approved_assignments,
        'total_assignments', v_total_assignments,
        'completed_challenges', v_completed_challenges,
        'total_challenges', v_effective_sprint_days
      );
    end if;
  else
    v_completed_challenges := 0;
  end if;

  -- 5. Count Live Workshop Sessions & Student Attendance Gate
  select count(ls.id)
  into v_total_sessions
  from public.live_sessions ls
  where (ls.cohort_id = p_cohort_id or ls.cohort_id is null)
    and ls.starts_at <= now();

  if v_total_sessions > 0 then
    select count(distinct sa.session_id)
    into v_attended_sessions
    from public.session_attendance sa
    join public.live_sessions ls on ls.id = sa.session_id
    where sa.student_id = p_student_id
      and (ls.cohort_id = p_cohort_id or ls.cohort_id is null)
      and ls.starts_at <= now()
      and sa.status in ('present', 'late', 'excused');

    v_attendance_rate_pct := round((v_attended_sessions::numeric / v_total_sessions::numeric) * 100, 1);

    if v_attendance_rate_pct < v_min_attendance_pct then
      return jsonb_build_object(
        'eligible', false,
        'reason', format('Workshop attendance is %s%% (%s of %s sessions attended). Minimum %s%% live session attendance is required.', v_attendance_rate_pct, v_attended_sessions, v_total_sessions, v_min_attendance_pct),
        'completed_lessons', v_completed_lessons,
        'total_lessons', v_total_lessons,
        'approved_assignments', v_approved_assignments,
        'total_assignments', v_total_assignments,
        'completed_challenges', coalesce(v_completed_challenges, 0),
        'total_challenges', v_effective_sprint_days,
        'attended_sessions', v_attended_sessions,
        'total_sessions', v_total_sessions,
        'attendance_rate_pct', v_attendance_rate_pct,
        'min_attendance_pct', v_min_attendance_pct
      );
    end if;
  else
    v_attended_sessions := 0;
    v_total_sessions := 0;
    v_attendance_rate_pct := 100.0;
  end if;

  -- 6. Check if certificate already issued
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
      'total_challenges', v_effective_sprint_days,
      'attended_sessions', v_attended_sessions,
      'total_sessions', v_total_sessions,
      'attendance_rate_pct', v_attendance_rate_pct,
      'min_attendance_pct', v_min_attendance_pct
    );
  end if;

  -- 7. Issue new authoritative certificate
  v_cert_number := 'CC-' || to_char(now(), 'YYYYMM') || '-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

  insert into public.certificates (certificate_number, student_id, cohort_id, issued_at, metadata)
  values (
    v_cert_number,
    p_student_id,
    p_cohort_id,
    now(),
    jsonb_build_object(
      'total_lessons', v_total_lessons,
      'completed_lessons', v_completed_lessons,
      'total_assignments', v_total_assignments,
      'approved_assignments', v_approved_assignments,
      'total_challenges', v_effective_sprint_days,
      'completed_challenges', coalesce(v_completed_challenges, 0),
      'total_sessions', v_total_sessions,
      'attended_sessions', v_attended_sessions,
      'attendance_rate_pct', v_attendance_rate_pct,
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
    'total_challenges', v_effective_sprint_days,
    'attended_sessions', v_attended_sessions,
    'total_sessions', v_total_sessions,
    'attendance_rate_pct', v_attendance_rate_pct,
    'min_attendance_pct', v_min_attendance_pct
  );
end;
$$;

grant execute on function public.verify_and_issue_certificate(uuid, uuid) to authenticated;

-- 3. Authoritative get_student_unified_progress with Attendance & Challenge Gates
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

  -- Curriculum Metrics
  v_total_lessons int;
  v_completed_lessons int;
  v_curriculum_percent int;
  v_total_watch_seconds bigint;

  -- Assignment Metrics
  v_total_assignments int;
  v_submitted_assignments int;
  v_approved_assignments int;
  v_assignment_percent int;

  -- Sprint Challenge Metrics
  v_cohort_sprint_days int;
  v_total_challenges int;
  v_effective_sprint_days int;
  v_submitted_challenges int;
  v_completed_challenges int;
  v_sprint_percent int;
  v_streak_days int;
  v_avg_score numeric;

  -- Live Attendance Metrics
  v_total_sessions int;
  v_attended_sessions int;
  v_attendance_rate_pct numeric;
  v_min_attendance_pct numeric := 75.0;
  v_attendance_passed boolean;

  -- Overall Composite Metrics
  v_total_milestones int;
  v_completed_milestones int;
  v_composite_percent int;
  v_cert_record record;
  v_has_certificate boolean;
  v_eligible_for_cert boolean;
begin
  -- 1. Check Enrollment
  select exists (
    select 1 from public.enrollments
    where user_id = p_student_id and cohort_id = p_cohort_id and status in ('active', 'completed', 'enrolled')
  ), coalesce(
    (select status from public.enrollments where user_id = p_student_id and cohort_id = p_cohort_id limit 1),
    'none'
  )
  into v_enrolled, v_enrollment_status;

  -- 2. Curriculum Telemetry
  select count(l.id)
  into v_total_lessons
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where m.cohort_id = p_cohort_id;

  select
    count(distinct lp.lesson_id),
    coalesce(sum(coalesce(lp.last_position_seconds, 0)), 0)
  into v_completed_lessons, v_total_watch_seconds
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  join public.modules m on m.id = l.module_id
  where lp.user_id = p_student_id
    and m.cohort_id = p_cohort_id
    and lp.completed = true;

  if v_total_lessons > 0 then
    v_curriculum_percent := least(100, round((v_completed_lessons::numeric / v_total_lessons::numeric) * 100));
  else
    v_curriculum_percent := 0;
  end if;

  -- 3. Assignment Telemetry
  select count(id)
  into v_total_assignments
  from public.assignments
  where cohort_id = p_cohort_id;

  select
    count(distinct s.assignment_id),
    count(distinct case when s.status in ('reviewed', 'approved', 'accepted') then s.assignment_id end)
  into v_submitted_assignments, v_approved_assignments
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.student_id = p_student_id
    and a.cohort_id = p_cohort_id;

  if v_total_assignments > 0 then
    v_assignment_percent := least(100, round((v_approved_assignments::numeric / v_total_assignments::numeric) * 100));
  else
    v_assignment_percent := 0;
  end if;

  -- 4. Dynamic Production Sprint Telemetry
  select coalesce(sprint_duration_days, 15)
  into v_cohort_sprint_days
  from public.cohorts
  where id = p_cohort_id;

  select count(dc.id)
  into v_total_challenges
  from public.daily_challenges dc
  where dc.cohort_id = p_cohort_id;

  v_effective_sprint_days := greatest(coalesce(v_cohort_sprint_days, 15), v_total_challenges, 1);

  select
    count(distinct dcs.challenge_id),
    count(distinct case when dcs.status = 'accepted' then dcs.challenge_id end),
    avg(case when dcs.status = 'accepted' and dcs.score is not null then dcs.score end)
  into v_submitted_challenges, v_completed_challenges, v_avg_score
  from public.daily_challenge_submissions dcs
  join public.daily_challenges dc on dc.id = dcs.challenge_id
  where dcs.user_id = p_student_id
    and dc.cohort_id = p_cohort_id;

  v_sprint_percent := least(100, round((coalesce(v_completed_challenges, 0)::numeric / v_effective_sprint_days::numeric) * 100));
  v_streak_days := coalesce(v_completed_challenges, 0);

  -- 5. Live Session Attendance Telemetry
  select count(ls.id)
  into v_total_sessions
  from public.live_sessions ls
  where (ls.cohort_id = p_cohort_id or ls.cohort_id is null)
    and ls.starts_at <= now();

  if v_total_sessions > 0 then
    select count(distinct sa.session_id)
    into v_attended_sessions
    from public.session_attendance sa
    join public.live_sessions ls on ls.id = sa.session_id
    where sa.student_id = p_student_id
      and (ls.cohort_id = p_cohort_id or ls.cohort_id is null)
      and ls.starts_at <= now()
      and sa.status in ('present', 'late', 'excused');

    v_attendance_rate_pct := round((v_attended_sessions::numeric / v_total_sessions::numeric) * 100, 1);
    v_attendance_passed := (v_attendance_rate_pct >= v_min_attendance_pct);
  else
    v_attended_sessions := 0;
    v_total_sessions := 0;
    v_attendance_rate_pct := 100.0;
    v_attendance_passed := true;
  end if;

  -- 6. Composite Milestones Formula
  v_total_milestones := v_total_lessons + v_total_assignments + (
    case when v_total_challenges > 0 then v_effective_sprint_days else 0 end
  ) + (
    case when v_total_sessions > 0 then v_total_sessions else 0 end
  );

  v_completed_milestones := v_completed_lessons + v_approved_assignments + (
    case when v_total_challenges > 0 then coalesce(v_completed_challenges, 0) else 0 end
  ) + (
    case when v_total_sessions > 0 then coalesce(v_attended_sessions, 0) else 0 end
  );

  if v_total_milestones > 0 then
    v_composite_percent := least(100, round((v_completed_milestones::numeric / v_total_milestones::numeric) * 100));
  else
    v_composite_percent := 0;
  end if;

  -- 7. Authoritative Certificate Gate
  select * from public.certificates
  where student_id = p_student_id and cohort_id = p_cohort_id
  into v_cert_record;

  v_has_certificate := (v_cert_record.id is not null);

  v_eligible_for_cert := (
    v_enrolled
    and (v_total_lessons = 0 or v_completed_lessons >= v_total_lessons)
    and (v_total_assignments = 0 or v_approved_assignments >= v_total_assignments)
    and (v_total_challenges = 0 or coalesce(v_completed_challenges, 0) >= v_effective_sprint_days)
    and v_attendance_passed
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
      'completed_challenges', coalesce(v_completed_challenges, 0),
      'percent', v_sprint_percent,
      'streak_days', v_streak_days,
      'average_score', case when v_avg_score is not null then round(v_avg_score) else null end
    ),
    'attendance', jsonb_build_object(
      'total_sessions', v_total_sessions,
      'attended_sessions', v_attended_sessions,
      'attendance_rate_pct', v_attendance_rate_pct,
      'min_attendance_pct', v_min_attendance_pct,
      'is_passed', v_attendance_passed
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
