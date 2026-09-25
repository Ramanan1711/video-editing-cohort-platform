-- ==============================================================================
-- supabase/migrations/20260925000001_cohort_leaderboard_rls.sql
-- Enables Single Active Cohort Enrollment & Non-Recursive Peer Leaderboard
-- Schema: enrollments(user_id, cohort_id, status, created_at)
-- ==============================================================================

-- 0. Update status check constraint on enrollments to allow 'inactive' and 'active'
alter table public.enrollments drop constraint if exists enrollments_status_check;
alter table public.enrollments add constraint enrollments_status_check
  check (status in ('enrolled', 'active', 'inactive', 'waitlist', 'waitlisted', 'completed', 'dropped'));

-- 1. Helper function: check if authenticated user is active in a cohort (Security Definer avoids RLS infinite recursion)
create or replace function public.is_enrolled_in_cohort(p_cohort_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.enrollments
    where user_id = auth.uid()
      and cohort_id = p_cohort_id
      and status in ('enrolled', 'active')
  );
$$;

-- 2. Allow enrolled students to view peer enrollments within their same cohort without recursion
drop policy if exists "Enrollments select policy" on public.enrollments;
drop policy if exists "Users can view enrollments" on public.enrollments;
drop policy if exists "Users can view their enrollments" on public.enrollments;
drop policy if exists "Users can view their own enrollments" on public.enrollments;
drop policy if exists "Enrolled students can view cohort peers and staff can read all" on public.enrollments;

create policy "Enrollments select policy"
  on public.enrollments for select
  to authenticated
  using (
    (user_id = auth.uid() and public.is_active_user())
    or public.is_admin()
    or public.is_mentor_for_cohort(cohort_id)
    or (public.is_active_user() and public.is_enrolled_in_cohort(cohort_id))
  );

-- Allow students and admins to update enrollment records (e.g. self-updating to inactive)
drop policy if exists "Students can update own enrollment status" on public.enrollments;
create policy "Students can update own enrollment status"
  on public.enrollments for update
  to authenticated
  using (
    (user_id = auth.uid() and public.is_active_user())
    or public.is_admin()
  )
  with check (
    (user_id = auth.uid() and public.is_active_user())
    or public.is_admin()
  );

-- 3. Automatic Database Trigger: Enforce single active cohort enrollment per student
-- Whenever a student is enrolled or set to active in any cohort, automatically
-- mark all their other active cohort enrollments as 'inactive'.
create or replace function public.enforce_single_active_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('enrolled', 'active') then
    update public.enrollments
    set status = 'inactive'
    where user_id = new.user_id
      and cohort_id != new.cohort_id
      and status in ('enrolled', 'active');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_single_active_enrollment on public.enrollments;
create trigger trg_enforce_single_active_enrollment
  after insert or update of status, cohort_id on public.enrollments
  for each row
  when (new.status in ('enrolled', 'active'))
  execute function public.enforce_single_active_enrollment();

-- 4. One-time cleanup for existing duplicate active enrollments:
-- For any students currently enrolled in multiple cohorts, keep the latest one active
-- and mark previous ones as 'inactive'.
with ranked_enrollments as (
  select
    user_id,
    cohort_id,
    row_number() over (
      partition by user_id
      order by created_at desc
    ) as rn
  from public.enrollments
  where status in ('enrolled', 'active')
)
update public.enrollments e
set status = 'inactive'
from ranked_enrollments re
where e.user_id = re.user_id
  and e.cohort_id = re.cohort_id
  and re.rn > 1;

-- 5. Updated RPC: enroll_student_in_cohort
-- Safely enrolls student, deactivating other cohorts, and respecting capacity
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

  select id, title, status, capacity, visibility, enrollment_start, enrollment_end
  into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort % not found.', p_cohort_id
      using errcode = 'P0002';
  end if;

  if not public.is_admin() then
    if v_cohort.status not in ('published') then
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
    if v_existing_enrollment.status in ('enrolled', 'active', 'waitlist') then
      return jsonb_build_object(
        'success', true,
        'already_enrolled', true,
        'status', v_existing_enrollment.status,
        'message', 'User is already enrolled in this cohort.'
      );
    else
      update public.enrollments
      set status = 'enrolled', created_at = now()
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
    created_at
  )
  values (
    p_cohort_id,
    v_target_student_id,
    v_enrollment_status,
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

-- 6. Allow authenticated community members to view gamification XP on leaderboards
drop policy if exists "Users can view own gamification record" on public.student_gamification;
drop policy if exists "Authenticated users can view gamification for leaderboard" on public.student_gamification;

create policy "Authenticated users can view gamification for leaderboard"
  on public.student_gamification for select
  to authenticated
  using (true);

-- 7. Security Definer RPC for Cohort-Scoped Leaderboard
-- Safely aggregates active enrolled students only, computes PRO points, and ranks them
create or replace function public.get_enrolled_cohort_leaderboard(p_cohort_id uuid default null)
returns table (
  user_id uuid,
  cohort_id uuid,
  cohort_title text,
  full_name text,
  email text,
  xp_points integer,
  editor_level integer,
  completed_lessons bigint,
  submissions_count bigint,
  reviewed_submissions_count bigint
) language plpgsql security definer set search_path = public as $$
begin
  return query
  with target_enrollments as (
    select
      e.user_id,
      e.cohort_id,
      coalesce(c.title, 'Course') as cohort_title
    from public.enrollments e
    left join public.cohorts c on c.id = e.cohort_id
    where (p_cohort_id is null or e.cohort_id = p_cohort_id)
      and e.status in ('enrolled', 'active')
  ),
  lesson_counts as (
    select
      lp.user_id,
      count(*)::bigint as completed_count
    from public.lesson_progress lp
    where lp.completed = true
    group by lp.user_id
  ),
  submission_counts as (
    select
      s.student_id,
      count(*)::bigint as total_count,
      count(*) filter (where s.status = 'reviewed')::bigint as reviewed_count
    from public.submissions s
    group by s.student_id
  )
  select
    te.user_id,
    te.cohort_id,
    te.cohort_title,
    coalesce(p.full_name, split_part(p.email, '@', 1), 'Enrolled Student') as full_name,
    p.email,
    greatest(
      coalesce(sg.xp_points, 0),
      (coalesce(lc.completed_count, 0) * 50 + coalesce(sc.total_count, 0) * 150 + coalesce(sc.reviewed_count, 0) * 300)::integer
    ) as xp_points,
    coalesce(sg.editor_level, 1) as editor_level,
    coalesce(lc.completed_count, 0) as completed_lessons,
    coalesce(sc.total_count, 0) as submissions_count,
    coalesce(sc.reviewed_count, 0) as reviewed_submissions_count
  from target_enrollments te
  left join public.profiles p on p.id = te.user_id
  left join public.student_gamification sg on sg.user_id = te.user_id
  left join lesson_counts lc on lc.user_id = te.user_id
  left join submission_counts sc on sc.student_id = te.user_id
  order by xp_points desc, full_name asc;
end;
$$;
