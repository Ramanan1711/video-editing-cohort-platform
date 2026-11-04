-- Migration: 20261104000003_allow_free_workshops_and_demo_sprints_enrollment.sql
-- Description: Allow students to enroll directly in free cohorts (workshops, masterclasses, demo sprints where price_inr <= 0)
-- without throwing policy errors or requiring Razorpay payment records, while keeping payment verification mandatory for paid cohorts.

-- ------------------------------------------------------------------------------
-- 1. Row Level Security: Allow Self-Enrollment for Free Cohorts or Paid Cohorts
-- ------------------------------------------------------------------------------

drop policy if exists "Students can self-enroll" on public.enrollments;
create policy "Students can self-enroll"
  on public.enrollments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_user()
    and status in ('enrolled', 'active', 'waitlist', 'waitlisted')
    and (
      public.is_admin()
      or exists (
        select 1 from public.cohorts c
        where c.id = enrollments.cohort_id
          and c.price_inr is not null
          and c.price_inr <= 0
      )
      or exists (
        select 1 from public.payments
        where user_id = auth.uid()
          and cohort_id = enrollments.cohort_id
          and status = 'captured'
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 2. Update enroll_student_in_cohort: Bypass Payment for Free Cohorts
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
      'status', v_enrollment_status,
      'action_by', auth.uid()
    )
  );

  return jsonb_build_object(
    'success', true,
    'status', v_enrollment_status,
    'enrollment', row_to_json(v_new_enrollment)
  );
end;
$$;

