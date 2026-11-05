-- Migration: Fix Live Attendance Cohort Scoping and Enrollment Date Filtering
-- Description: Restricts session counting to cohort_id = p_cohort_id and ensures starts_at >= enrollment.enrolled_at.
-- Prevents global academy webinars (cohort_id IS NULL) and pre-enrollment sessions from deflating attendance rates below 75%.

-- 1. Authoritative verify_and_issue_certificate RPC
drop function if exists public.verify_and_issue_certificate(uuid, uuid);
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
  v_enrolled_at timestamptz;
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
  -- 1. Check enrollment and capture enrollment timestamp
  select exists (
    select 1 from public.enrollments
    where user_id = p_student_id and cohort_id = p_cohort_id and status in ('active', 'completed', 'enrolled')
  ), (
    select coalesce(enrolled_at, created_at, now())
    from public.enrollments
    where user_id = p_student_id and cohort_id = p_cohort_id and status in ('active', 'completed', 'enrolled')
    order by coalesce(enrolled_at, created_at) asc
    limit 1
  )
  into v_enrolled, v_enrolled_at;

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
    and (
      (l.video_url is not null and length(trim(l.video_url)) > 0 and (lp.watch_percentage >= 80 or lp.completed = true))
      or ((l.video_url is null or length(trim(l.video_url)) = 0) and lp.completed = true)
    );

  if v_total_lessons > 0 and v_completed_lessons < v_total_lessons then
    return jsonb_build_object(
      'eligible', false,
      'reason', format('%s of %s required lessons incomplete (≥80%% watch verification required).', (v_total_lessons - v_completed_lessons), v_total_lessons),
      'completed_lessons', v_completed_lessons,
      'total_lessons', v_total_lessons,
      'approved_assignments', 0,
      'total_assignments', 0,
      'completed_challenges', 0,
      'total_challenges', 0,
      'attended_sessions', 0,
      'total_sessions', 0,
      'attendance_rate_pct', 0.0,
      'min_attendance_pct', v_min_attendance_pct
    );
  end if;

  -- 3. Count published assignments & approved submissions
  select count(a.id)
  into v_total_assignments
  from public.assignments a
  where a.cohort_id = p_cohort_id;

  select count(distinct s.assignment_id)
  into v_approved_assignments
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.student_id = p_student_id
    and a.cohort_id = p_cohort_id
    and s.status in ('reviewed', 'accepted', 'approved');

  if v_total_assignments > 0 and v_approved_assignments < v_total_assignments then
    return jsonb_build_object(
      'eligible', false,
      'reason', format('%s of %s project assignments not reviewed or approved by mentor.', (v_total_assignments - v_approved_assignments), v_total_assignments),
      'completed_lessons', v_completed_lessons,
      'total_lessons', v_total_lessons,
      'approved_assignments', v_approved_assignments,
      'total_assignments', v_total_assignments,
      'completed_challenges', 0,
      'total_challenges', 0,
      'attended_sessions', 0,
      'total_sessions', 0,
      'attendance_rate_pct', 0.0,
      'min_attendance_pct', v_min_attendance_pct
    );
  end if;

  -- 4. Count Authoritative Daily Sprint Challenges
  select sprint_duration_days
  into v_cohort_sprint_days
  from public.cohorts
  where id = p_cohort_id;

  select count(dc.id)
  into v_total_challenges
  from public.daily_challenges dc
  where dc.cohort_id = p_cohort_id;

  if v_total_challenges > 0 then
    v_effective_sprint_days := greatest(1, least(coalesce(v_cohort_sprint_days, v_total_challenges), v_total_challenges));

    select count(distinct dcs.challenge_id)
    into v_completed_challenges
    from public.daily_challenge_submissions dcs
    join public.daily_challenges dc on dc.id = dcs.challenge_id
    where dcs.user_id = p_student_id
      and dc.cohort_id = p_cohort_id
      and dcs.status = 'accepted';

    if coalesce(v_completed_challenges, 0) < v_effective_sprint_days then
      return jsonb_build_object(
        'eligible', false,
        'reason', format('Only %s of %s sprint challenges completed and accepted. Full sprint drill completion is required.', coalesce(v_completed_challenges, 0), v_effective_sprint_days),
        'completed_lessons', v_completed_lessons,
        'total_lessons', v_total_lessons,
        'approved_assignments', v_approved_assignments,
        'total_assignments', v_total_assignments,
        'completed_challenges', coalesce(v_completed_challenges, 0),
        'total_challenges', v_effective_sprint_days,
        'attended_sessions', 0,
        'total_sessions', 0,
        'attendance_rate_pct', 0.0,
        'min_attendance_pct', v_min_attendance_pct
      );
    end if;
  else
    v_effective_sprint_days := 0;
    v_completed_challenges := 0;
  end if;

  -- 5. Count Live Workshop Sessions & Student Attendance Gate
  -- Restrict strictly to cohort sessions held on or after student's enrollment
  select count(ls.id)
  into v_total_sessions
  from public.live_sessions ls
  where ls.cohort_id = p_cohort_id
    and ls.starts_at <= now()
    and (v_enrolled_at is null or ls.starts_at >= v_enrolled_at);

  if v_total_sessions > 0 then
    select count(distinct sa.session_id)
    into v_attended_sessions
    from public.session_attendance sa
    join public.live_sessions ls on ls.id = sa.session_id
    where sa.student_id = p_student_id
      and ls.cohort_id = p_cohort_id
      and ls.starts_at <= now()
      and (v_enrolled_at is null or ls.starts_at >= v_enrolled_at)
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

  -- 8. Mark enrollment completed
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


-- 2. Authoritative get_student_unified_progress RPC
drop function if exists public.get_student_unified_progress(uuid, uuid);
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
  v_enrolled_at timestamptz;
  v_enrollment_status text;

  -- Curriculum Lessons Metrics
  v_total_lessons int;
  v_completed_lessons int;
  v_curriculum_percent int;

  -- Project Assignments Metrics
  v_total_assignments int;
  v_submitted_assignments int;
  v_approved_assignments int;
  v_assignments_percent int;

  -- Production Sprint Challenges Metrics
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
  -- 1. Check Enrollment and capture enrolled_at timestamp
  select exists (
    select 1 from public.enrollments
    where user_id = p_student_id and cohort_id = p_cohort_id and status in ('active', 'completed', 'enrolled')
  ), coalesce(
    (select status from public.enrollments where user_id = p_student_id and cohort_id = p_cohort_id limit 1),
    'none'
  ), (
    select coalesce(enrolled_at, created_at, now())
    from public.enrollments
    where user_id = p_student_id and cohort_id = p_cohort_id and status in ('active', 'completed', 'enrolled')
    order by coalesce(enrolled_at, created_at) asc
    limit 1
  )
  into v_enrolled, v_enrollment_status, v_enrolled_at;

  -- 2. Curriculum Lessons Telemetry
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
    and (
      (l.video_url is not null and length(trim(l.video_url)) > 0 and (lp.watch_percentage >= 80 or lp.completed = true))
      or ((l.video_url is null or length(trim(l.video_url)) = 0) and lp.completed = true)
    );

  if v_total_lessons > 0 then
    v_curriculum_percent := least(100, round((v_completed_lessons::numeric / v_total_lessons::numeric) * 100));
  else
    v_curriculum_percent := 100;
  end if;

  -- 3. Project Assignments Telemetry
  select count(a.id)
  into v_total_assignments
  from public.assignments a
  where a.cohort_id = p_cohort_id;

  select
    count(distinct s.assignment_id),
    count(distinct case when s.status in ('reviewed', 'accepted', 'approved') then s.assignment_id end)
  into v_submitted_assignments, v_approved_assignments
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.student_id = p_student_id
    and a.cohort_id = p_cohort_id;

  if v_total_assignments > 0 then
    v_assignments_percent := least(100, round((v_approved_assignments::numeric / v_total_assignments::numeric) * 100));
  else
    v_assignments_percent := 100;
  end if;

  -- 4. Authoritative Production Sprint Challenges Telemetry
  select sprint_duration_days
  into v_cohort_sprint_days
  from public.cohorts
  where id = p_cohort_id;

  select count(dc.id)
  into v_total_challenges
  from public.daily_challenges dc
  where dc.cohort_id = p_cohort_id;

  if v_total_challenges > 0 then
    v_effective_sprint_days := greatest(1, least(coalesce(v_cohort_sprint_days, v_total_challenges), v_total_challenges));
  else
    v_effective_sprint_days := 0;
  end if;

  select
    count(distinct dcs.challenge_id),
    count(distinct case when dcs.status = 'accepted' then dcs.challenge_id end),
    coalesce(round(avg(dcs.score), 1), 0)
  into v_submitted_challenges, v_completed_challenges, v_avg_score
  from public.daily_challenge_submissions dcs
  join public.daily_challenges dc on dc.id = dcs.challenge_id
  where dcs.user_id = p_student_id
    and dc.cohort_id = p_cohort_id;

  if v_effective_sprint_days > 0 then
    v_sprint_percent := least(100, round((coalesce(v_completed_challenges, 0)::numeric / v_effective_sprint_days::numeric) * 100));
  else
    v_sprint_percent := 100;
  end if;
  v_streak_days := coalesce(v_completed_challenges, 0);

  -- 5. Live Session Attendance Telemetry
  -- Restrict strictly to cohort sessions held on or after student's enrollment
  select count(ls.id)
  into v_total_sessions
  from public.live_sessions ls
  where ls.cohort_id = p_cohort_id
    and ls.starts_at <= now()
    and (v_enrolled_at is null or ls.starts_at >= v_enrolled_at);

  if v_total_sessions > 0 then
    select count(distinct sa.session_id)
    into v_attended_sessions
    from public.session_attendance sa
    join public.live_sessions ls on ls.id = sa.session_id
    where sa.student_id = p_student_id
      and ls.cohort_id = p_cohort_id
      and ls.starts_at <= now()
      and (v_enrolled_at is null or ls.starts_at >= v_enrolled_at)
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
    v_enrolled and
    (v_total_lessons = 0 or v_completed_lessons >= v_total_lessons) and
    (v_total_assignments = 0 or v_approved_assignments >= v_total_assignments) and
    (v_effective_sprint_days = 0 or coalesce(v_completed_challenges, 0) >= v_effective_sprint_days) and
    v_attendance_passed
  );

  return jsonb_build_object(
    'student_id', p_student_id,
    'cohort_id', p_cohort_id,
    'enrollment_status', v_enrollment_status,
    'overall', jsonb_build_object(
      'composite_percent', v_composite_percent,
      'completed_milestones', v_completed_milestones,
      'total_milestones', v_total_milestones,
      'has_certificate', v_has_certificate,
      'certificate_number', v_cert_record.certificate_number,
      'certificate_issued_at', v_cert_record.issued_at,
      'is_eligible_for_certificate', v_eligible_for_cert
    ),
    'curriculum', jsonb_build_object(
      'total_lessons', v_total_lessons,
      'completed_lessons', v_completed_lessons,
      'progress_percent', v_curriculum_percent
    ),
    'assignments', jsonb_build_object(
      'total_assignments', v_total_assignments,
      'submitted_assignments', v_submitted_assignments,
      'approved_assignments', v_approved_assignments,
      'progress_percent', v_assignments_percent
    ),
    'sprint', jsonb_build_object(
      'sprint_duration_days', v_effective_sprint_days,
      'total_challenges', v_total_challenges,
      'submitted_challenges', v_submitted_challenges,
      'completed_challenges', coalesce(v_completed_challenges, 0),
      'progress_percent', v_sprint_percent,
      'streak_days', v_streak_days,
      'average_score', v_avg_score
    ),
    'attendance', jsonb_build_object(
      'total_held_sessions', v_total_sessions,
      'attended_sessions', v_attended_sessions,
      'attendance_rate_pct', v_attendance_rate_pct,
      'min_attendance_pct', v_min_attendance_pct,
      'attendance_passed', v_attendance_passed
    )
  );
end;
$$;

grant execute on function public.get_student_unified_progress(uuid, uuid) to authenticated;


-- 3. Authoritative get_internship_report RPC
drop function if exists public.get_internship_report(uuid, uuid);
create or replace function public.get_internship_report(
  p_student_id uuid,
  p_cohort_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort record;
  v_student record;
  v_enrolled_at timestamptz;
  v_effective_sprint_days int;
  v_max_challenge_day int;
  v_total_challenges int;
  v_completed_drills int;
  v_total_drill_score numeric;
  v_scored_drills int;
  v_drill_avg_score numeric;
  v_drill_pct numeric;
  v_drills_snapshot jsonb;
  v_total_lessons int;
  v_completed_lessons int;
  v_lesson_pct numeric;
  v_total_assignments int;
  v_approved_assignments int;
  v_assignment_pct numeric;
  v_total_sessions int;
  v_attended_sessions int;
  v_attendance_pct numeric;
  v_composite_score numeric;
  v_grade text;
  v_lor_eligible boolean;
  v_existing_report record;
  v_result jsonb;
begin
  -- 1. Verify existence of cohort and student
  select * from public.cohorts where id = p_cohort_id into v_cohort;
  if v_cohort.id is null then
    raise exception 'Cohort % not found', p_cohort_id;
  end if;

  select * from public.profiles where id = p_student_id into v_student;
  if v_student.id is null then
    raise exception 'Student profile % not found', p_student_id;
  end if;

  -- Capture student enrollment timestamp
  select coalesce(enrolled_at, created_at, now())
  into v_enrolled_at
  from public.enrollments
  where user_id = p_student_id and cohort_id = p_cohort_id and status in ('active', 'completed', 'enrolled')
  order by coalesce(enrolled_at, created_at) asc
  limit 1;

  -- 2. Determine sprint duration
  select count(id), coalesce(max(day_number), 0)
  into v_total_challenges, v_max_challenge_day
  from public.daily_challenges
  where cohort_id = p_cohort_id;

  if v_total_challenges > 0 then
    v_effective_sprint_days := greatest(1, least(coalesce(v_cohort.sprint_duration_days, v_total_challenges), v_total_challenges));
  else
    v_effective_sprint_days := 0;
  end if;

  -- 3. Gather daily challenge submissions telemetry
  select 
    count(case when s.status = 'accepted' then 1 end),
    coalesce(sum(case when s.score is not null then s.score else 0 end), 0),
    count(case when s.score is not null then 1 end)
  into 
    v_completed_drills,
    v_total_drill_score,
    v_scored_drills
  from public.daily_challenges c
  left join public.daily_challenge_submissions s 
    on s.challenge_id = c.id and s.user_id = p_student_id
  where c.cohort_id = p_cohort_id;

  if v_scored_drills > 0 then
    v_drill_avg_score := v_total_drill_score / v_scored_drills;
  else
    v_drill_avg_score := case when v_completed_drills > 0 then 85.0 else 0.0 end;
  end if;

  if v_effective_sprint_days > 0 then
    v_drill_pct := least(100.0, round((v_completed_drills::numeric / v_effective_sprint_days::numeric) * 100.0, 2));
  else
    v_drill_pct := 100.0;
  end if;

  -- Build drills array snapshot
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'day_number', c.day_number,
      'title', c.title,
      'status', coalesce(s.status, 'unsubmitted'),
      'score', s.score,
      'feedback', s.mentor_feedback,
      'submitted_at', s.submitted_at,
      'reviewed_at', s.reviewed_at
    ) order by c.day_number asc
  ), '[]'::jsonb)
  into v_drills_snapshot
  from public.daily_challenges c
  left join public.daily_challenge_submissions s 
    on s.challenge_id = c.id and s.user_id = p_student_id
  where c.cohort_id = p_cohort_id;

  -- 4. Gather curriculum lesson watch telemetry
  select count(l.id)
  into v_total_lessons
  from public.modules m
  join public.lessons l on l.module_id = m.id
  where m.cohort_id = p_cohort_id;

  if v_total_lessons > 0 then
    select count(distinct lp.lesson_id)
    into v_completed_lessons
    from public.modules m
    join public.lessons l on l.module_id = m.id
    join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = p_student_id
    where m.cohort_id = p_cohort_id
      and (lp.completed = true or coalesce(lp.watch_percentage, 0) >= 80);
    v_lesson_pct := round((v_completed_lessons::numeric / v_total_lessons::numeric) * 100.0, 2);
  else
    v_completed_lessons := 0;
    v_lesson_pct := 100.0;
  end if;

  -- 5. Gather capstone assignments telemetry
  select count(a.id)
  into v_total_assignments
  from public.assignments a
  where a.cohort_id = p_cohort_id;

  if v_total_assignments > 0 then
    select count(distinct sub.assignment_id)
    into v_approved_assignments
    from public.assignments a
    join public.submissions sub on sub.assignment_id = a.id and sub.student_id = p_student_id
    where a.cohort_id = p_cohort_id
      and sub.status in ('reviewed', 'accepted', 'approved');
    v_assignment_pct := round((v_approved_assignments::numeric / v_total_assignments::numeric) * 100.0, 2);
  else
    v_approved_assignments := 0;
    v_assignment_pct := 100.0;
  end if;

  -- 6. Gather live workshop attendance telemetry
  -- Restrict strictly to cohort sessions held on or after student's enrollment
  select count(ls.id)
  into v_total_sessions
  from public.live_sessions ls
  where ls.cohort_id = p_cohort_id
    and ls.starts_at <= now()
    and (v_enrolled_at is null or ls.starts_at >= v_enrolled_at);

  if v_total_sessions > 0 then
    select count(distinct sa.session_id)
    into v_attended_sessions
    from public.live_sessions ls
    join public.session_attendance sa on sa.session_id = ls.id and sa.student_id = p_student_id
    where ls.cohort_id = p_cohort_id
      and ls.starts_at <= now()
      and (v_enrolled_at is null or ls.starts_at >= v_enrolled_at)
      and sa.status in ('present', 'late', 'excused');
    v_attendance_pct := round((v_attended_sessions::numeric / v_total_sessions::numeric) * 100.0, 2);
  else
    v_attended_sessions := 0;
    v_attendance_pct := 100.0;
  end if;

  -- 7. Calculate composite weighted score
  -- Weighting: 40% Sprint Drills + 30% Capstone Assignments + 15% Lessons + 15% Attendance
  v_composite_score := round(
    (v_drill_pct * 0.40) +
    (v_assignment_pct * 0.30) +
    (v_lesson_pct * 0.15) +
    (v_attendance_pct * 0.15),
    2
  );

  -- 8. Calculate Grade & LOR Eligibility
  if v_completed_drills < (v_effective_sprint_days * 0.5) then
    v_grade := 'Incomplete';
  elsif v_composite_score >= 90.0 then
    v_grade := 'A+';
  elsif v_composite_score >= 80.0 then
    v_grade := 'A';
  elsif v_composite_score >= 70.0 then
    v_grade := 'B+';
  elsif v_composite_score >= 60.0 then
    v_grade := 'B';
  elsif v_composite_score >= 50.0 then
    v_grade := 'C';
  else
    v_grade := 'Fail';
  end if;

  -- LOR certification requires high performance across drills and attendance
  v_lor_eligible := (v_composite_score >= 85.0 and v_attendance_pct >= 75.0 and v_completed_drills >= (v_effective_sprint_days * 0.8));

  -- 9. Upsert report record
  insert into public.internship_reports (
    cohort_id,
    student_id,
    evaluator_id,
    title,
    status,
    composite_score,
    grade,
    attendance_rate_pct,
    completed_drills_count,
    total_drills_count,
    technical_rating,
    consistency_rating,
    creative_rating,
    summary_notes,
    strengths,
    growth_areas,
    recommendation,
    lor_eligible,
    telemetry_snapshot,
    generated_at,
    updated_at
  )
  values (
    p_cohort_id,
    p_student_id,
    null,
    coalesce(v_cohort.name, v_cohort.title, 'Cohort') || ' - Internship Evaluation',
    'approved',
    v_composite_score,
    v_grade,
    v_attendance_pct,
    v_completed_drills,
    v_effective_sprint_days,
    least(5, greatest(1, round(v_composite_score / 20.0))),
    least(5, greatest(1, round(v_attendance_pct / 20.0))),
    least(5, greatest(1, round(v_drill_avg_score / 20.0))),
    format('Automated evaluation for %s in %s. Curriculum Watch: %s%%, Project Capstones: %s%%, Sprint Drills: %s%%, Workshop Attendance: %s%%.',
      v_student.full_name, coalesce(v_cohort.name, v_cohort.title), v_lesson_pct, v_assignment_pct, v_drill_pct, v_attendance_pct),
    array['Timeline Architecture', 'Color Science', 'Pacing Discipline'],
    case when v_attendance_pct < 85.0 then array['Live Session Attendance Consistency'] else array['Sound Design Foley Depth'] end,
    case when v_grade in ('A+', 'A') then 'Strongly recommended for Junior/Mid Video Editor roles.' else 'Recommended for continued supervised cutting.' end,
    v_lor_eligible,
    jsonb_build_object(
      'lessons_percent', v_lesson_pct,
      'assignments_percent', v_assignment_pct,
      'drills_percent', v_drill_pct,
      'attendance_percent', v_attendance_pct,
      'drills', v_drills_snapshot
    ),
    now(),
    now()
  )
  on conflict (cohort_id, student_id) do update set
    composite_score = excluded.composite_score,
    grade = excluded.grade,
    attendance_rate_pct = excluded.attendance_rate_pct,
    completed_drills_count = excluded.completed_drills_count,
    total_drills_count = excluded.total_drills_count,
    technical_rating = excluded.technical_rating,
    consistency_rating = excluded.consistency_rating,
    creative_rating = excluded.creative_rating,
    summary_notes = excluded.summary_notes,
    lor_eligible = excluded.lor_eligible,
    telemetry_snapshot = excluded.telemetry_snapshot,
    updated_at = now()
  returning * into v_existing_report;

  -- 10. Format and return response
  return jsonb_build_object(
    'id', v_existing_report.id,
    'cohort_id', v_existing_report.cohort_id,
    'student_id', v_existing_report.student_id,
    'cohort_name', coalesce(v_cohort.name, v_cohort.title),
    'student_name', v_student.full_name,
    'student_email', v_student.email,
    'composite_score', v_existing_report.composite_score,
    'grade', v_existing_report.grade,
    'attendance_rate_pct', v_existing_report.attendance_rate_pct,
    'completed_drills_count', v_existing_report.completed_drills_count,
    'total_drills_count', v_existing_report.total_drills_count,
    'technical_rating', v_existing_report.technical_rating,
    'consistency_rating', v_existing_report.consistency_rating,
    'creative_rating', v_existing_report.creative_rating,
    'summary_notes', v_existing_report.summary_notes,
    'strengths', v_existing_report.strengths,
    'growth_areas', v_existing_report.growth_areas,
    'recommendation', v_existing_report.recommendation,
    'lor_eligible', v_existing_report.lor_eligible,
    'telemetry_snapshot', v_existing_report.telemetry_snapshot,
    'generated_at', v_existing_report.generated_at,
    'updated_at', v_existing_report.updated_at
  );
end;
$$;

grant execute on function public.get_internship_report(uuid, uuid) to authenticated;


-- 4. Authoritative get_cohort_attendance_report RPC
drop function if exists public.get_cohort_attendance_report(uuid);
create or replace function public.get_cohort_attendance_report(
  p_cohort_id uuid
)
returns table (
  student_id uuid,
  student_name text,
  student_email text,
  sessions_held bigint,
  attended_count bigint,
  attendance_rate_pct numeric,
  last_attended_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  with cohort_students as (
    select
      e.user_id,
      p.full_name,
      p.email,
      coalesce(e.enrolled_at, e.created_at, now()) as enrolled_at
    from public.enrollments e
    join public.profiles p on p.id = e.user_id
    where e.cohort_id = p_cohort_id
      and e.status in ('active', 'completed', 'enrolled')
  ),
  student_stats as (
    select
      cs.user_id,
      cs.full_name,
      cs.email,
      count(ls.id) as sessions_held,
      count(sa.id) filter (where sa.status in ('present', 'late', 'excused')) as attended_count,
      max(sa.join_time) as last_attended_at
    from cohort_students cs
    left join public.live_sessions ls
      on ls.cohort_id = p_cohort_id
      and ls.starts_at <= now()
      and ls.starts_at >= cs.enrolled_at
    left join public.session_attendance sa
      on sa.student_id = cs.user_id
      and sa.session_id = ls.id
    group by cs.user_id, cs.full_name, cs.email
  )
  select
    user_id as student_id,
    full_name as student_name,
    email as student_email,
    sessions_held,
    attended_count,
    case
      when sessions_held > 0 then round((attended_count::numeric / sessions_held::numeric) * 100.0, 1)
      else 100.0
    end as attendance_rate_pct,
    last_attended_at
  from student_stats
  order by attendance_rate_pct desc, full_name asc;
$$;

grant execute on function public.get_cohort_attendance_report(uuid) to authenticated;

