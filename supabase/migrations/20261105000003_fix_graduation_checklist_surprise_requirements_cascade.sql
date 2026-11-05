-- Migration: Fix Graduation Checklist Surprise Requirements Cascade & Active Enrollment Self-Healing
-- Description:
-- 1. Ensures verify_and_issue_certificate calculates all 4 pillars upfront
--    (lessons, assignments, sprint challenges, live workshop sessions) before checking eligibility,
--    so student progress is never masked with false 0/0 counts.
-- 2. Restores and self-heals enrollment for staff members (admin/mentor) and active learners with completed
--    lesson progress, preventing false-negative "Student is not actively enrolled in this cohort." rejections.
-- 3. Removes the accidental multi-cohort deactivation in enroll_student_in_cohort and re-activates
--    any enrollments inadvertently marked inactive.

-- 1. Restore any inadvertent inactive enrollments
update public.enrollments
set status = 'enrolled',
    updated_at = now()
where status = 'inactive'
  and (enrolled_at is not null or created_at is not null);

-- 2. Authoritative verify_and_issue_certificate RPC
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
  -- 1. Calculate Pillar 1: Lessons Telemetry Upfront
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

  -- 2. Calculate Pillar 2: Project Assignments Telemetry Upfront
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

  -- 3. Calculate Pillar 3: Authoritative Daily Sprint Challenges Telemetry Upfront
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

  -- 4. Check Active Cohort Enrollment & Self-Healing
  select exists (
    select 1 from public.enrollments
    where user_id = p_student_id and cohort_id = p_cohort_id and status in ('active', 'completed', 'enrolled', 'inactive')
  ), (
    select coalesce(enrolled_at, created_at, now())
    from public.enrollments
    where user_id = p_student_id and cohort_id = p_cohort_id and status in ('active', 'completed', 'enrolled', 'inactive')
    order by coalesce(enrolled_at, created_at) asc
    limit 1
  )
  into v_enrolled, v_enrolled_at;

  -- Auto-restore inactive enrollment (caused by previous single-active cohort policy)
  if v_enrolled then
    update public.enrollments
    set status = 'enrolled', updated_at = now()
    where user_id = p_student_id and cohort_id = p_cohort_id and status = 'inactive';
  end if;

  -- Self-heal / auto-enroll if user is staff (admin/mentor) or has completed lessons in this cohort
  if not v_enrolled then
    if exists (
      select 1 from public.profiles
      where id = p_student_id and role in ('admin', 'mentor')
    ) or v_completed_lessons > 0 then
      insert into public.enrollments (user_id, cohort_id, status, enrolled_at, created_at, updated_at)
      values (p_student_id, p_cohort_id, 'enrolled', now(), now(), now())
      on conflict (user_id, cohort_id) do update
      set status = 'enrolled', updated_at = now();

      v_enrolled := true;
      v_enrolled_at := now();
    end if;
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

  -- 6. Evaluate Enrollment Gate
  if not v_enrolled then
    return jsonb_build_object(
      'eligible', false,
      'enrolled', false,
      'reason', 'Student is not actively enrolled in this cohort.',
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

  -- 7. Evaluate Overall 4-Pillar Eligibility
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
      'enrolled', true,
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

  -- 8. Check if certificate already issued
  select * from public.certificates
  where student_id = p_student_id and cohort_id = p_cohort_id
  into v_existing_cert;

  if v_existing_cert.id is not null then
    return jsonb_build_object(
      'eligible', true,
      'enrolled', true,
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

  -- 9. Issue new authoritative certificate
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

  -- 10. Mark enrollment completed
  update public.enrollments
  set status = 'completed', updated_at = now()
  where user_id = p_student_id and cohort_id = p_cohort_id;

  return jsonb_build_object(
    'eligible', true,
    'enrolled', true,
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

-- 3. Fortify enroll_student_in_cohort: Remove deactivation of other cohorts
create or replace function public.enroll_student_in_cohort(
  p_cohort_id uuid,
  p_student_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_student_id uuid;
  v_cohort record;
  v_existing_enrollment record;
  v_new_enrollment record;
begin
  v_target_student_id := coalesce(p_student_id, auth.uid());

  if v_target_student_id is null then
    raise exception 'Authentication required to enroll in cohort.'
      using errcode = '42501';
  end if;

  if v_target_student_id != auth.uid() and not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: Only administrators can enroll other students.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_target_student_id and coalesce(status, 'active') = 'active'
  ) then
    raise exception 'Cannot enroll: Student account is suspended or inactive.'
      using errcode = 'P0001';
  end if;

  select id, coalesce(title, name, 'Cohort') as title, status, capacity, visibility, enrollment_start, enrollment_end, price_inr
  into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort % not found.', p_cohort_id
      using errcode = 'P0002';
  end if;

  -- For non-admin callers, a captured payment is mandatory only if the cohort has a positive price (or default fee).
  -- Free workshops, introductory masterclasses, and demo sprints (explicitly price_inr <= 0) bypass checkout.
  if not (public.is_admin() and public.is_active_user()) then
    if coalesce(v_cohort.price_inr, 4999) > 0 then
      if not exists (
        select 1 from public.payments
        where user_id = v_target_student_id
          and cohort_id = p_cohort_id
          and status = 'captured'
      ) then
        raise exception 'Payment required to enroll in this cohort. Please complete checkout.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if not (public.is_admin() and public.is_active_user()) then
    if v_cohort.status not in ('published', 'active') then
      raise exception 'Cohort is not currently open for enrollment (Status: %).', v_cohort.status
        using errcode = 'P0001';
    end if;

    if v_cohort.enrollment_start is not null and now() < v_cohort.enrollment_start then
      raise exception 'Enrollment for this cohort has not started yet (Opens: %).', v_cohort.enrollment_start
        using errcode = 'P0001';
    end if;

    if v_cohort.enrollment_end is not null and now() > v_cohort.enrollment_end then
      raise exception 'Enrollment for this cohort closed on %.', v_cohort.enrollment_end
        using errcode = 'P0001';
    end if;
  end if;

  -- Check existing enrollment in this cohort (without deactivating any other cohorts)
  select cohort_id, user_id, status
  into v_existing_enrollment
  from public.enrollments
  where cohort_id = p_cohort_id and user_id = v_target_student_id;

  if found then
    if v_existing_enrollment.status in ('enrolled', 'active', 'waitlist', 'waitlisted', 'completed') then
      return jsonb_build_object(
        'success', true,
        'already_enrolled', true,
        'status', v_existing_enrollment.status,
        'message', 'User is already enrolled in this cohort.'
      );
    else
      update public.enrollments
      set status = 'enrolled',
          created_at = coalesce(created_at, now()),
          enrolled_at = coalesce(enrolled_at, now()),
          updated_at = now()
      where cohort_id = p_cohort_id and user_id = v_target_student_id
      returning * into v_new_enrollment;

      perform public.log_audit_event(
        'enrollment.reactivated',
        'enrollment',
        v_target_student_id,
        jsonb_build_object('cohort_id', p_cohort_id, 'status', 'enrolled')
      );

      return jsonb_build_object(
        'success', true,
        'reactivated', true,
        'status', 'enrolled',
        'message', 'Enrollment reactivated successfully.'
      );
    end if;
  end if;

  -- Create new enrollment
  insert into public.enrollments (user_id, cohort_id, status, created_at, enrolled_at, updated_at)
  values (v_target_student_id, p_cohort_id, 'enrolled', now(), now(), now())
  returning * into v_new_enrollment;

  perform public.log_audit_event(
    'enrollment.created',
    'enrollment',
    v_target_student_id,
    jsonb_build_object('cohort_id', p_cohort_id, 'status', 'enrolled')
  );

  return jsonb_build_object(
    'success', true,
    'enrolled', true,
    'status', 'enrolled',
    'message', 'Enrolled in cohort successfully.'
  );
end;
$$;

grant execute on function public.enroll_student_in_cohort(uuid, uuid) to authenticated;
grant execute on function public.enroll_student_in_cohort(uuid, uuid) to service_role;
