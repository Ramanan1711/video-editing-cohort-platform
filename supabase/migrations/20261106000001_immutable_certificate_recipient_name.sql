-- Migration: 20261106000001_immutable_certificate_recipient_name.sql
-- Description: Security Audit & Credential Integrity Remediation
--              1. Adds `recipient_name text` column to public.certificates.
--              2. Backfills existing certificates with student_name from metadata or profiles.
--              3. Updates verify_and_issue_certificate RPC to freeze recipient_name at issuance.
--              4. Updates verify_certificate_authenticity to read the immutable recipient_name.
--              5. Adds strict RLS blocking students from updating public.certificates.

-- 1. Ensure recipient_name column exists on public.certificates
alter table public.certificates add column if not exists recipient_name text;

-- 2. Backfill existing certificates with recipient_name
update public.certificates
set recipient_name = coalesce(
  nullif(trim(metadata->>'student_name'), ''),
  (select nullif(trim(full_name), '') from public.profiles where id = certificates.student_id),
  'Verified Graduate'
)
where recipient_name is null;

-- 3. Disallow students from updating certificates (Immutable Credential Rule)
drop policy if exists "Certificates not updatable by students" on public.certificates;
create policy "Certificates not updatable by students"
  on public.certificates for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Authoritative verify_and_issue_certificate RPC with recipient_name snapshot
drop function if exists public.verify_and_issue_certificate(uuid, uuid);
drop function if exists public.verify_and_issue_certificate(uuid, uuid, text);
create or replace function public.verify_and_issue_certificate(
  p_student_id uuid,
  p_cohort_id uuid,
  p_legal_name text
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
  v_recipient_name text;
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

  -- Auto-restore inactive enrollment
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
      'recipient_name', coalesce(
        nullif(trim(v_existing_cert.recipient_name), ''),
        nullif(trim(v_existing_cert.metadata->>'student_name'), ''),
        (select nullif(trim(full_name), '') from public.profiles where id = p_student_id),
        'Verified Graduate'
      ),
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

  -- 9. Resolve confirmed recipient name for new issuance
  select coalesce(
    nullif(trim(p_legal_name), ''),
    nullif(trim(full_name), ''),
    'Verified Graduate'
  )
  into v_recipient_name
  from public.profiles
  where id = p_student_id;

  if v_recipient_name is null or v_recipient_name = '' then
    v_recipient_name := 'Verified Graduate';
  end if;

  -- 10. Issue new authoritative certificate with frozen recipient_name
  v_cert_number := 'CC-' || to_char(now(), 'YYYYMM') || '-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

  insert into public.certificates (
    certificate_number,
    student_id,
    cohort_id,
    recipient_name,
    issued_at,
    metadata
  )
  values (
    v_cert_number,
    p_student_id,
    p_cohort_id,
    v_recipient_name,
    now(),
    jsonb_build_object(
      'student_name', v_recipient_name,
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

  -- 11. Mark enrollment completed
  update public.enrollments
  set status = 'completed', updated_at = now()
  where user_id = p_student_id and cohort_id = p_cohort_id;

  return jsonb_build_object(
    'eligible', true,
    'enrolled', true,
    'newly_issued', true,
    'certificate_number', v_new_cert.certificate_number,
    'recipient_name', v_recipient_name,
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

-- 4b. 2-parameter backwards-compatible overload for verify_and_issue_certificate(uuid, uuid)
create or replace function public.verify_and_issue_certificate(
  p_student_id uuid,
  p_cohort_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.verify_and_issue_certificate(p_student_id, p_cohort_id, null::text);
end;
$$;

grant execute on function public.verify_and_issue_certificate(uuid, uuid) to authenticated;
grant execute on function public.verify_and_issue_certificate(uuid, uuid, text) to authenticated;

-- 5. Authoritative Public Verification Function: verify_certificate_authenticity
drop function if exists public.verify_certificate_authenticity(text);
create or replace function public.verify_certificate_authenticity(p_certificate_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cert record;
begin
  if p_certificate_number is null or trim(p_certificate_number) = '' then
    return jsonb_build_object(
      'valid', false,
      'error', 'Please provide a valid certificate number.'
    );
  end if;

  select 
    c.id,
    c.certificate_number,
    c.student_id,
    c.cohort_id,
    c.issued_at,
    c.metadata,
    coalesce(
      nullif(trim(c.recipient_name), ''),
      nullif(trim(c.metadata->>'student_name'), ''),
      nullif(trim(p.full_name), ''),
      'Verified Graduate'
    ) as student_name,
    coalesce(co.name, co.title, 'Creative Editing Cohort') as cohort_name
  into v_cert
  from public.certificates c
  join public.profiles p on p.id = c.student_id
  join public.cohorts co on co.id = c.cohort_id
  where lower(trim(c.certificate_number)) = lower(trim(p_certificate_number));

  if v_cert.id is null then
    return jsonb_build_object(
      'valid', false,
      'error', 'Certificate not found. The provided certificate number is invalid or has not been issued.'
    );
  end if;

  return jsonb_build_object(
    'valid', true,
    'certificate_number', v_cert.certificate_number,
    'recipient_name', v_cert.student_name,
    'student_id', v_cert.student_id,
    'student_name', v_cert.student_name,
    'cohort_id', v_cert.cohort_id,
    'cohort_name', v_cert.cohort_name,
    'issued_at', v_cert.issued_at,
    'metadata', v_cert.metadata
  );
end;
$$;

grant execute on function public.verify_certificate_authenticity(text) to anon, authenticated;

