-- ==============================================================================
-- Migration: 20260928000006_canonical_cohorts_enrollments_mentor_mapping.sql
-- Description: Canonical schema harmonization for cohorts, enrollments, and mentor mapping.
-- Resolves:
--   1. Dual timestamp columns (created_at and enrolled_at) on public.enrollments with sync triggers.
--   2. Harmonized enrollment status constraint covering ('enrolled', 'active', 'inactive', 'waitlist', 'waitlisted', 'completed', 'dropped').
--   3. Dual timestamp columns (created_at and assigned_at) on public.mentor_cohorts with sync triggers.
--   4. Dual name compatibility (name and title) on public.cohorts with sync triggers.
--   5. Full RLS policies for student rosters, mentor scoping, and administrative governance.
--   6. Fortified canonical enroll_student_in_cohort RPC.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Harmonize public.cohorts (title, name, track_type, duration_days, capacity)
-- ------------------------------------------------------------------------------
create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled Cohort',
  name text,
  description text,
  status text not null default 'published',
  capacity integer not null default 30,
  visibility text not null default 'public',
  enrollment_start timestamptz,
  enrollment_end timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  track_type text default 'general',
  duration_days integer default 15,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure all columns exist on cohorts
alter table public.cohorts add column if not exists name text;
alter table public.cohorts add column if not exists title text;
alter table public.cohorts add column if not exists track_type text default 'general';
alter table public.cohorts add column if not exists duration_days integer default 15;
alter table public.cohorts add column if not exists capacity integer default 30;
alter table public.cohorts add column if not exists status text default 'published';
alter table public.cohorts add column if not exists visibility text default 'public';
alter table public.cohorts add column if not exists enrollment_start timestamptz;
alter table public.cohorts add column if not exists enrollment_end timestamptz;
alter table public.cohorts add column if not exists start_date timestamptz;
alter table public.cohorts add column if not exists end_date timestamptz;
alter table public.cohorts add column if not exists created_at timestamptz not null default now();
alter table public.cohorts add column if not exists updated_at timestamptz not null default now();

-- Synchronize existing rows
update public.cohorts set name = title where name is null and title is not null;
update public.cohorts set title = name where title is null and name is not null;
update public.cohorts set name = 'Untitled Cohort' where name is null;
update public.cohorts set title = 'Untitled Cohort' where title is null;

-- Bidirectional sync trigger function for cohorts (name <-> title)
create or replace function public.sync_cohort_names_and_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.title := coalesce(new.title, new.name, 'Untitled Cohort');
  new.name := coalesce(new.name, new.title, 'Untitled Cohort');
  new.track_type := coalesce(new.track_type, 'general');
  new.duration_days := coalesce(new.duration_days, 15);
  new.capacity := coalesce(new.capacity, 30);
  new.updated_at := coalesce(new.updated_at, now());
  return new;
end;
$$;

drop trigger if exists trg_sync_cohort_names on public.cohorts;
create trigger trg_sync_cohort_names
  before insert or update on public.cohorts
  for each row
  execute function public.sync_cohort_names_and_metadata();

-- Constraints for cohorts
do $$
begin
  alter table public.cohorts drop constraint if exists cohorts_track_type_check;
  alter table public.cohorts add constraint cohorts_track_type_check
    check (track_type in ('coding', 'non_coding', 'general'));

  alter table public.cohorts drop constraint if exists cohorts_status_check;
  alter table public.cohorts add constraint cohorts_status_check
    check (status in ('draft', 'review', 'published', 'archived', 'upcoming', 'active', 'completed'));
exception when others then
  null;
end $$;

-- ------------------------------------------------------------------------------
-- 2. Harmonize public.enrollments (created_at, enrolled_at, unified statuses)
-- ------------------------------------------------------------------------------
create table if not exists public.enrollments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  status text not null default 'enrolled',
  created_at timestamptz not null default now(),
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, cohort_id)
);

-- Ensure dual columns exist
alter table public.enrollments add column if not exists created_at timestamptz default now();
alter table public.enrollments add column if not exists enrolled_at timestamptz default now();
alter table public.enrollments add column if not exists updated_at timestamptz default now();

-- Synchronize existing rows
update public.enrollments set created_at = enrolled_at where created_at is null and enrolled_at is not null;
update public.enrollments set enrolled_at = created_at where enrolled_at is null and created_at is not null;
update public.enrollments set created_at = now() where created_at is null;
update public.enrollments set enrolled_at = now() where enrolled_at is null;

-- Harmonize enrollment status check constraint across all migrations
alter table public.enrollments drop constraint if exists enrollments_status_check;
alter table public.enrollments add constraint enrollments_status_check
  check (status in ('enrolled', 'active', 'inactive', 'waitlist', 'waitlisted', 'completed', 'dropped'));

-- Bidirectional sync trigger function for enrollments (created_at <-> enrolled_at)
create or replace function public.sync_enrollment_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := coalesce(new.created_at, new.enrolled_at, now());
  new.enrolled_at := coalesce(new.enrolled_at, new.created_at, now());
  new.updated_at := coalesce(new.updated_at, now());
  return new;
end;
$$;

drop trigger if exists trg_sync_enrollment_timestamps on public.enrollments;
create trigger trg_sync_enrollment_timestamps
  before insert or update on public.enrollments
  for each row
  execute function public.sync_enrollment_timestamps();

-- Indexes for performance
create index if not exists idx_enrollments_user_id on public.enrollments(user_id);
create index if not exists idx_enrollments_cohort_id on public.enrollments(cohort_id);
create index if not exists idx_enrollments_cohort_status on public.enrollments(cohort_id, status);
create index if not exists idx_enrollments_created_at on public.enrollments(created_at desc);
create index if not exists idx_enrollments_enrolled_at on public.enrollments(enrolled_at desc);

-- ------------------------------------------------------------------------------
-- 3. Harmonize public.mentor_cohorts (created_at, assigned_at)
-- ------------------------------------------------------------------------------
create table if not exists public.mentor_cohorts (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  created_at timestamptz not null default now(),
  assigned_at timestamptz not null default now(),
  unique (mentor_id, cohort_id)
);

-- Ensure dual columns exist
alter table public.mentor_cohorts add column if not exists created_at timestamptz default now();
alter table public.mentor_cohorts add column if not exists assigned_at timestamptz default now();

-- Synchronize existing rows
update public.mentor_cohorts set created_at = assigned_at where created_at is null and assigned_at is not null;
update public.mentor_cohorts set assigned_at = created_at where assigned_at is null and created_at is not null;
update public.mentor_cohorts set created_at = now() where created_at is null;
update public.mentor_cohorts set assigned_at = now() where assigned_at is null;

-- Bidirectional sync trigger function for mentor_cohorts (created_at <-> assigned_at)
create or replace function public.sync_mentor_cohorts_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := coalesce(new.created_at, new.assigned_at, now());
  new.assigned_at := coalesce(new.assigned_at, new.created_at, now());
  return new;
end;
$$;

drop trigger if exists trg_sync_mentor_cohorts_timestamps on public.mentor_cohorts;
create trigger trg_sync_mentor_cohorts_timestamps
  before insert or update on public.mentor_cohorts
  for each row
  execute function public.sync_mentor_cohorts_timestamps();

-- Indexes for mentor cohorts
create index if not exists idx_mentor_cohorts_mentor on public.mentor_cohorts(mentor_id);
create index if not exists idx_mentor_cohorts_cohort on public.mentor_cohorts(cohort_id);

-- ------------------------------------------------------------------------------
-- 4. Row Level Security Policies
-- ------------------------------------------------------------------------------

-- RLS for mentor_cohorts
alter table public.mentor_cohorts enable row level security;

drop policy if exists "Admins can manage mentor_cohorts" on public.mentor_cohorts;
create policy "Admins can manage mentor_cohorts"
  on public.mentor_cohorts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Mentors can view own cohort assignments" on public.mentor_cohorts;
drop policy if exists "Authenticated users can view mentor assignments" on public.mentor_cohorts;
create policy "Authenticated users can view mentor assignments"
  on public.mentor_cohorts for select
  to authenticated
  using (true);

-- RLS for enrollments
alter table public.enrollments enable row level security;

drop policy if exists "Admins have full management on enrollments" on public.enrollments;
create policy "Admins have full management on enrollments"
  on public.enrollments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Enrollments select policy" on public.enrollments;
create policy "Enrollments select policy"
  on public.enrollments for select
  to authenticated
  using (
    (user_id = auth.uid() and public.is_active_user())
    or public.is_mentor_for_cohort(cohort_id)
    or public.is_admin()
  );

drop policy if exists "Students can self-enroll" on public.enrollments;
create policy "Students can self-enroll"
  on public.enrollments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_user()
    and status in ('enrolled', 'active', 'waitlist', 'waitlisted')
  );

drop policy if exists "Students can update own enrollment status" on public.enrollments;
create policy "Students can update own enrollment status"
  on public.enrollments for update
  to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and status in ('inactive', 'dropped'));

-- ------------------------------------------------------------------------------
-- 5. Canonical enroll_student_in_cohort RPC
-- ------------------------------------------------------------------------------
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
  v_current_enrollments integer;
  v_existing_enrollment record;
  v_enrollment_status text := 'enrolled';
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

  select id, coalesce(title, name, 'Cohort') as title, status, capacity, visibility, enrollment_start, enrollment_end
  into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort % not found.', p_cohort_id
      using errcode = 'P0002';
  end if;

  if not public.is_admin() then
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

  -- Deactivate any other active cohorts for this student
  update public.enrollments
  set status = 'inactive'
  where user_id = v_target_student_id
    and cohort_id != p_cohort_id
    and status in ('enrolled', 'active');

  -- Check existing enrollment in this cohort
  select cohort_id, user_id, status
  into v_existing_enrollment
  from public.enrollments
  where cohort_id = p_cohort_id and user_id = v_target_student_id;

  if found then
    if v_existing_enrollment.status in ('enrolled', 'active', 'waitlist', 'waitlisted') then
      return jsonb_build_object(
        'success', true,
        'already_enrolled', true,
        'status', v_existing_enrollment.status,
        'message', 'User is already enrolled in this cohort.'
      );
    else
      update public.enrollments
      set status = 'enrolled',
          created_at = now(),
          enrolled_at = now(),
          updated_at = now()
      where cohort_id = p_cohort_id and user_id = v_target_student_id
      returning * into v_new_enrollment;

      perform public.log_audit_event(
        'enrollment.reactivated',
        'enrollment',
        v_target_student_id::text || ':' || p_cohort_id::text,
        jsonb_build_object('cohort_id', p_cohort_id, 'student_id', v_target_student_id)
      );

      return jsonb_build_object(
        'success', true,
        'status', 'enrolled',
        'message', 'Enrollment reactivated successfully.'
      );
    end if;
  end if;

  select count(*)
  into v_current_enrollments
  from public.enrollments
  where cohort_id = p_cohort_id and status in ('enrolled', 'active');

  if v_cohort.capacity is not null and v_current_enrollments >= v_cohort.capacity then
    v_enrollment_status := 'waitlist';
  else
    v_enrollment_status := 'enrolled';
  end if;

  insert into public.enrollments (
    cohort_id,
    user_id,
    status,
    created_at,
    enrolled_at,
    updated_at
  )
  values (
    p_cohort_id,
    v_target_student_id,
    v_enrollment_status,
    now(),
    now(),
    now()
  )
  returning * into v_new_enrollment;

  perform public.log_audit_event(
    'enrollment.created',
    'enrollment',
    v_target_student_id::text || ':' || p_cohort_id::text,
    jsonb_build_object(
      'cohort_id', p_cohort_id,
      'student_id', v_target_student_id,
      'status', v_enrollment_status
    )
  );

  return jsonb_build_object(
    'success', true,
    'status', v_enrollment_status,
    'message', 'Enrolled successfully.'
  );
end;
$$;

grant execute on function public.enroll_student_in_cohort(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 6. Canonical Overview View for Reporting & Diagnostics
-- ------------------------------------------------------------------------------
create or replace view public.cohort_roster_summary as
select
  c.id as cohort_id,
  coalesce(c.title, c.name, 'Cohort') as cohort_name,
  c.status as cohort_status,
  c.capacity,
  c.track_type,
  count(e.user_id) filter (where e.status in ('enrolled', 'active')) as active_enrollments_count,
  count(e.user_id) filter (where e.status in ('waitlist', 'waitlisted')) as waitlist_count,
  count(e.user_id) filter (where e.status = 'completed') as completed_count,
  count(e.user_id) filter (where e.status = 'dropped') as dropped_count,
  count(distinct mc.mentor_id) as assigned_mentors_count
from public.cohorts c
left join public.enrollments e on e.cohort_id = c.id
left join public.mentor_cohorts mc on mc.cohort_id = c.id
group by c.id, c.title, c.name, c.status, c.capacity, c.track_type;

grant select on public.cohort_roster_summary to authenticated;
