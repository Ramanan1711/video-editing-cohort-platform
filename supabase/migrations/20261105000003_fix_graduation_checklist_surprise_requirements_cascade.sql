-- Migration: Fix Graduation Checklist Surprise Requirements Cascade
-- Description: Ensures verify_and_issue_certificate calculates all 4 pillars upfront
-- (lessons, assignments, sprint challenges, live workshop sessions) before checking eligibility.
-- Prevents premature short-circuiting that returned hardcoded 0s for subsequent pillars and
-- misled students into thinking uncompleted requirements were already satisfied.

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
  v_is_lessons_complete boolean;
  v_is_assigns_complete boolean;
  v_is_challenges_complete boolean;
  v_is_attendance_complete boolean;
  v_reason text;
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

  -- 2. Calculate Pillar 1: Lessons Telemetry
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

  v_total_lessons := coalesce(v_total_lessons, 0);
  v_completed_lessons := coalesce(v_completed_lessons, 0);
  v_is_lessons_complete := (v_total_lessons = 0 or v_completed_lessons >= v_total_lessons);

  -- 3. Calculate Pillar 2: Project Assignments Telemetry
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

  v_total_assignments := coalesce(v_total_assignments, 0);
  v_approved_assignments := coalesce(v_approved_assignments, 0);
  v_is_assigns_complete := (v_total_assignments = 0 or v_approved_assignments >= v_total_assignments);

  -- 4. Calculate Pillar 3: Authoritative Daily Sprint Challenges Telemetry
  select sprint_duration_days
  into v_cohort_sprint_days
  from public.cohorts
  where id = p_cohort_id;

  select count(dc.id)
  into v_total_challenges
  from public.daily_challenges dc
  where dc.cohort_id = p_cohort_id;

  v_total_challenges := coalesce(v_total_challenges, 0);

  if v_total_challenges > 0 then
    v_effective_sprint_days := greatest(1, least(coalesce(v_cohort_sprint_days, v_total_challenges), v_total_challenges));

    select count(distinct dcs.challenge_id)
    into v_completed_challenges
    from public.daily_challenge_submissions dcs
    join public.daily_challenges dc on dc.id = dcs.challenge_id
    where dcs.user_id = p_student_id
      and dc.cohort_id = p_cohort_id
      and dcs.status = 'accepted';

    v_completed_challenges := coalesce(v_completed_challenges, 0);
    v_is_challenges_complete := (v_completed_challenges >= v_effective_sprint_days);
  else
    v_effective_sprint_days := 0;
    v_completed_challenges := 0;
    v_is_challenges_complete := true;
  end if;

  -- 5. Calculate Pillar 4: Live Workshop Sessions & Student Attendance Telemetry
  -- Restrict strictly to cohort sessions held on or after student's enrollment
  select count(ls.id)
  into v_total_sessions
  from public.live_sessions ls
  where ls.cohort_id = p_cohort_id
    and ls.starts_at <= now()
    and (v_enrolled_at is null or ls.starts_at >= v_enrolled_at);

  v_total_sessions := coalesce(v_total_sessions, 0);

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

    v_attended_sessions := coalesce(v_attended_sessions, 0);
    v_attendance_rate_pct := round((v_attended_sessions::numeric / v_total_sessions::numeric) * 100, 1);
    v_is_attendance_complete := (v_attendance_rate_pct >= v_min_attendance_pct);
  else
    v_attended_sessions := 0;
    v_attendance_rate_pct := 100.0;
    v_is_attendance_complete := true;
  end if;

  -- 6. Evaluate Overall 4-Pillar Eligibility
  if not (v_is_lessons_complete and v_is_assigns_complete and v_is_challenges_complete and v_is_attendance_complete) then
    if not v_is_lessons_complete then
      v_reason := format('%s of %s required lessons incomplete (≥80%% watch verification required).', (v_total_lessons - v_completed_lessons), v_total_lessons);
    elsif not v_is_assigns_complete then
      v_reason := format('%s of %s project assignments not reviewed or approved by mentor.', (v_total_assignments - v_approved_assignments), v_total_assignments);
    elsif not v_is_challenges_complete then
      v_reason := format('Only %s of %s sprint challenges completed and accepted. Full sprint drill completion is required.', v_completed_challenges, v_effective_sprint_days);
    else
      v_reason := format('Workshop attendance is %s%% (%s of %s sessions attended). Minimum %s%% live session attendance is required.', v_attendance_rate_pct, v_attended_sessions, v_total_sessions, v_min_attendance_pct);
    end if;

    return jsonb_build_object(
      'eligible', false,
      'reason', v_reason,
      'completed_lessons', v_completed_lessons,
      'total_lessons', v_total_lessons,
      'approved_assignments', v_approved_assignments,
      'total_assignments', v_total_assignments,
      'completed_challenges', v_completed_challenges,
      'total_challenges', v_effective_sprint_days,
      'attended_sessions', v_attended_sessions,
      'total_sessions', v_total_sessions,
      'attendance_rate_pct', v_attendance_rate_pct,
      'min_attendance_pct', v_min_attendance_pct
    );
  end if;

  -- 7. Check if certificate already issued
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
      'completed_challenges', v_completed_challenges,
      'total_challenges', v_effective_sprint_days,
      'attended_sessions', v_attended_sessions,
      'total_sessions', v_total_sessions,
      'attendance_rate_pct', v_attendance_rate_pct,
      'min_attendance_pct', v_min_attendance_pct
    );
  end if;

  -- 8. Issue new authoritative certificate
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
      'completed_challenges', v_completed_challenges,
      'total_sessions', v_total_sessions,
      'attended_sessions', v_attended_sessions,
      'attendance_rate_pct', v_attendance_rate_pct,
      'verified_by', 'system'
    )
  )
  returning * into v_new_cert;

  -- 9. Mark enrollment completed
  update public.enrollments
  set status = 'completed'
  where user_id = p_student_id and cohort_id = p_cohort_id;

  return jsonb_build_object(
    'eligible', true,
    'newly_issued', true,
    'certificate_number', v_new_cert.certificate_number,
    'issued_at', v_new_cert.issued_at,
    'completed_lessons', v_completed_lessons,
    'total_lessons', v_total_lessons,
    'approved_assignments', v_approved_assignments,
    'total_assignments', v_total_assignments,
    'completed_challenges', v_completed_challenges,
    'total_challenges', v_effective_sprint_days,
    'attended_sessions', v_attended_sessions,
    'total_sessions', v_total_sessions,
    'attendance_rate_pct', v_attendance_rate_pct,
    'min_attendance_pct', v_min_attendance_pct
  );
end;
$$;

grant execute on function public.verify_and_issue_certificate(uuid, uuid) to authenticated;

