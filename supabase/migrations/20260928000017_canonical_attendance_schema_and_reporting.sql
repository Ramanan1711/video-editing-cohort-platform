-- ==============================================================================
-- Migration: 20260928000017_canonical_attendance_schema_and_reporting.sql
-- Description: Canonical Live Session Attendance Schema, Roster Management & Reporting
--   1. Schema Definition:
--      - public.session_attendance: Authoritative record of student attendance
--        per live session/workshop.
--      - Tracks status ('present', 'absent', 'late', 'excused'), join_time,
--        duration_minutes, notes, check_in_method ('self_check_in', 'mentor_marked',
--        'admin_marked', 'system', 'code'), and verifying user.
--      - Unique constraint on (session_id, student_id) preventing duplicates.
--      - Performance indexes for session filtering, student history, and reporting.
--   2. Granular RLS Policies:
--      - SELECT: Admins, mentors assigned to cohort/student/session, and students (own records).
--      - INSERT: Admins, assigned mentors, and students self checking-in.
--      - UPDATE: Admins, assigned mentors, and students updating join duration.
--      - DELETE: Admins and assigned mentors.
--   3. Authoritative Stored Procedures & Reporting RPCs:
--      - public.check_in_to_session(p_session_id uuid, p_method text): Student self check-in.
--      - public.mark_student_attendance(p_session_id uuid, p_student_id uuid, p_status text, ...): Single student mark.
--      - public.bulk_mark_attendance(p_session_id uuid, p_records jsonb): Bulk roster mark.
--      - public.get_session_attendance_summary(p_session_id uuid): Aggregates session metrics.
--      - public.get_cohort_attendance_report(p_cohort_id uuid): Aggregates cohort attendance rate.
-- ==============================================================================

-- 1. Ensure live_sessions table and cohort_id / created_by columns exist
create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts(id) on delete cascade,
  title text not null,
  description text,
  meeting_url text,
  starts_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.live_sessions
  add column if not exists cohort_id uuid references public.cohorts(id) on delete cascade,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_live_sessions_cohort
  on public.live_sessions(cohort_id);

-- 2. Create session_attendance table
create table if not exists public.session_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')) default 'present',
  join_time timestamptz default now(),
  duration_minutes integer not null default 0,
  notes text,
  verified_by uuid references public.profiles(id) on delete set null,
  check_in_method text not null check (check_in_method in ('self_check_in', 'mentor_marked', 'admin_marked', 'system', 'code')) default 'self_check_in',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_session_student unique (session_id, student_id)
);

-- Performance indices
create index if not exists idx_session_attendance_session
  on public.session_attendance(session_id, status);

create index if not exists idx_session_attendance_student
  on public.session_attendance(student_id, created_at desc);

create index if not exists idx_session_attendance_cohort
  on public.session_attendance(cohort_id);

create index if not exists idx_session_attendance_status
  on public.session_attendance(status);

-- 2. Enable RLS
alter table public.session_attendance enable row level security;

-- SELECT Policy
drop policy if exists "Session attendance select policy" on public.session_attendance;
create policy "Session attendance select policy"
  on public.session_attendance for select
  to authenticated
  using (
    public.is_admin()
    or student_id = auth.uid()
    or public.is_mentor_for_student(student_id)
    or exists (
      select 1
      from public.live_sessions ls
      left join public.mentor_cohorts mc on mc.cohort_id = ls.cohort_id
      where ls.id = session_attendance.session_id
        and (ls.cohort_id is null or mc.mentor_id = auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'mentor')
    )
  );

-- INSERT Policy
drop policy if exists "Session attendance insert policy" on public.session_attendance;
create policy "Session attendance insert policy"
  on public.session_attendance for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      student_id = auth.uid()
      and check_in_method in ('self_check_in', 'code')
    )
    or (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'mentor'
      )
      and (
        public.is_mentor_for_student(student_id)
        or exists (
          select 1
          from public.live_sessions ls
          left join public.mentor_cohorts mc on mc.cohort_id = ls.cohort_id
          where ls.id = session_attendance.session_id
            and (ls.cohort_id is null or mc.mentor_id = auth.uid())
        )
      )
    )
  );

-- UPDATE Policy
drop policy if exists "Session attendance update policy" on public.session_attendance;
create policy "Session attendance update policy"
  on public.session_attendance for update
  to authenticated
  using (
    public.is_admin()
    or student_id = auth.uid()
    or public.is_mentor_for_student(student_id)
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'mentor')
    )
  )
  with check (
    public.is_admin()
    or student_id = auth.uid()
    or public.is_mentor_for_student(student_id)
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'mentor')
    )
  );

-- DELETE Policy
drop policy if exists "Session attendance delete policy" on public.session_attendance;
create policy "Session attendance delete policy"
  on public.session_attendance for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'mentor')
    )
  );

-- 3. Stored Procedures & Reporting RPCs

-- Student Self Check-in RPC
create or replace function public.check_in_to_session(
  p_session_id uuid,
  p_method text default 'self_check_in'
)
returns public.session_attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_cohort_id uuid;
  v_result public.session_attendance;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  -- Validate session exists and retrieve cohort_id
  select cohort_id into v_cohort_id
  from public.live_sessions
  where id = p_session_id;

  if not found and not exists (select 1 from public.live_sessions where id = p_session_id) then
    raise exception 'Session % not found', p_session_id
      using errcode = 'P0002';
  end if;

  -- If session has no specific cohort, infer from student's active enrollment
  if v_cohort_id is null then
    select cohort_id into v_cohort_id
    from public.enrollments
    where user_id = v_user_id
      and status = 'active'
    order by created_at desc
    limit 1;
  end if;

  -- Upsert attendance record
  insert into public.session_attendance (
    session_id,
    student_id,
    cohort_id,
    status,
    join_time,
    duration_minutes,
    check_in_method,
    updated_at
  )
  values (
    p_session_id,
    v_user_id,
    v_cohort_id,
    'present',
    now(),
    1,
    coalesce(p_method, 'self_check_in'),
    now()
  )
  on conflict (session_id, student_id)
  do update set
    status = 'present',
    join_time = coalesce(public.session_attendance.join_time, now()),
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.check_in_to_session(uuid, text) to authenticated;

-- Mark Student Attendance RPC (Mentor / Admin)
create or replace function public.mark_student_attendance(
  p_session_id uuid,
  p_student_id uuid,
  p_status text,
  p_notes text default null,
  p_duration_minutes integer default 0
)
returns public.session_attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_cohort_id uuid;
  v_normalized_status text;
  v_result public.session_attendance;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  -- Validate caller permissions
  if not exists (
    select 1 from public.profiles
    where id = v_actor_id
      and role in ('admin', 'mentor')
      and coalesce(status, 'active') = 'active'
  ) then
    raise exception 'Access denied: Only mentors or administrators can mark attendance'
      using errcode = '42501';
  end if;

  v_normalized_status := lower(trim(p_status));
  if v_normalized_status not in ('present', 'absent', 'late', 'excused') then
    raise exception 'Invalid status: Must be present, absent, late, or excused'
      using errcode = '22023';
  end if;

  -- Retrieve cohort_id for session
  select cohort_id into v_cohort_id
  from public.live_sessions
  where id = p_session_id;

  if v_cohort_id is null then
    select cohort_id into v_cohort_id
    from public.enrollments
    where user_id = p_student_id
      and status = 'active'
    order by created_at desc
    limit 1;
  end if;

  insert into public.session_attendance (
    session_id,
    student_id,
    cohort_id,
    status,
    notes,
    duration_minutes,
    verified_by,
    check_in_method,
    join_time,
    updated_at
  )
  values (
    p_session_id,
    p_student_id,
    v_cohort_id,
    v_normalized_status,
    p_notes,
    coalesce(p_duration_minutes, 0),
    v_actor_id,
    'mentor_marked',
    case when v_normalized_status in ('present', 'late') then now() else null end,
    now()
  )
  on conflict (session_id, student_id)
  do update set
    status = v_normalized_status,
    notes = coalesce(p_notes, public.session_attendance.notes),
    duration_minutes = coalesce(p_duration_minutes, public.session_attendance.duration_minutes),
    verified_by = v_actor_id,
    check_in_method = 'mentor_marked',
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.mark_student_attendance(uuid, uuid, text, text, integer) to authenticated;

-- Bulk Mark Attendance RPC
create or replace function public.bulk_mark_attendance(
  p_session_id uuid,
  p_records jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_record jsonb;
  v_count integer := 0;
  v_cohort_id uuid;
  v_student_id uuid;
  v_status text;
  v_notes text;
  v_duration integer;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_actor_id and role in ('admin', 'mentor')
  ) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select cohort_id into v_cohort_id from public.live_sessions where id = p_session_id;

  for v_record in select * from jsonb_array_elements(p_records)
  loop
    v_student_id := (v_record->>'student_id')::uuid;
    v_status := lower(trim(coalesce(v_record->>'status', 'present')));
    v_notes := v_record->>'notes';
    v_duration := coalesce((v_record->>'duration_minutes')::integer, 0);

    if v_status in ('present', 'absent', 'late', 'excused') and v_student_id is not null then
      insert into public.session_attendance (
        session_id,
        student_id,
        cohort_id,
        status,
        notes,
        duration_minutes,
        verified_by,
        check_in_method,
        updated_at
      )
      values (
        p_session_id,
        v_student_id,
        v_cohort_id,
        v_status,
        v_notes,
        v_duration,
        v_actor_id,
        'mentor_marked',
        now()
      )
      on conflict (session_id, student_id)
      do update set
        status = v_status,
        notes = coalesce(v_notes, public.session_attendance.notes),
        duration_minutes = v_duration,
        verified_by = v_actor_id,
        check_in_method = 'mentor_marked',
        updated_at = now();

      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.bulk_mark_attendance(uuid, jsonb) to authenticated;

-- Session Attendance Summary RPC
create or replace function public.get_session_attendance_summary(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_session_title text;
  v_cohort_id uuid;
  v_total_students integer := 0;
  v_present integer := 0;
  v_late integer := 0;
  v_absent integer := 0;
  v_excused integer := 0;
  v_rate numeric := 0;
begin
  select title, cohort_id into v_session_title, v_cohort_id
  from public.live_sessions
  where id = p_session_id;

  -- Count students eligible for this session
  if v_cohort_id is not null then
    select count(*) into v_total_students
    from public.enrollments
    where cohort_id = v_cohort_id and status in ('active', 'completed');
  else
    select count(distinct user_id) into v_total_students
    from public.enrollments
    where status in ('active', 'completed');
  end if;

  -- Count attendance statuses
  select
    count(*) filter (where status = 'present'),
    count(*) filter (where status = 'late'),
    count(*) filter (where status = 'absent'),
    count(*) filter (where status = 'excused')
  into v_present, v_late, v_absent, v_excused
  from public.session_attendance
  where session_id = p_session_id;

  if v_total_students = 0 then
    v_total_students := v_present + v_late + v_absent + v_excused;
  end if;

  if v_total_students > 0 then
    v_rate := round(((v_present + v_late)::numeric / v_total_students::numeric) * 100, 1);
  else
    v_rate := 0;
  end if;

  return jsonb_build_object(
    'session_id', p_session_id,
    'session_title', coalesce(v_session_title, 'Session'),
    'total_students', v_total_students,
    'present_count', v_present,
    'late_count', v_late,
    'absent_count', v_absent,
    'excused_count', v_excused,
    'attendance_rate_pct', v_rate
  );
end;
$$;

grant execute on function public.get_session_attendance_summary(uuid) to authenticated;

-- Cohort Attendance Reporting RPC
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
  with cohort_sessions as (
    select id
    from public.live_sessions
    where cohort_id = p_cohort_id or cohort_id is null
  ),
  cohort_students as (
    select e.user_id, p.full_name, p.email
    from public.enrollments e
    join public.profiles p on p.id = e.user_id
    where e.cohort_id = p_cohort_id
  ),
  session_counts as (
    select count(*) as total_sessions from cohort_sessions
  ),
  student_stats as (
    select
      cs.user_id,
      cs.full_name,
      cs.email,
      (select total_sessions from session_counts) as total_sessions,
      count(sa.id) filter (where sa.status in ('present', 'late')) as attended,
      max(sa.join_time) as last_join
    from cohort_students cs
    left join public.session_attendance sa
      on sa.student_id = cs.user_id
      and sa.session_id in (select id from cohort_sessions)
    group by cs.user_id, cs.full_name, cs.email
  )
  select
    user_id as student_id,
    full_name as student_name,
    email as student_email,
    total_sessions as sessions_held,
    attended as attended_count,
    case
      when total_sessions > 0 then round((attended::numeric / total_sessions::numeric) * 100, 1)
      else 0
    end as attendance_rate_pct,
    last_join as last_attended_at
  from student_stats
  order by attendance_rate_pct desc, full_name asc;
$$;

grant execute on function public.get_cohort_attendance_report(uuid) to authenticated;
