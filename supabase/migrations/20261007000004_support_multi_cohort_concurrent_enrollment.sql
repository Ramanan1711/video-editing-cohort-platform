-- Migration: 20261007000004_support_multi_cohort_concurrent_enrollment.sql
-- Description: Enables true multi-cohort concurrent enrollment.
-- Eliminates legacy "single active cohort" deactivation that was setting
-- previously enrolled cohorts (e.g. Python) to 'inactive' when enrolling in Java.

-- 1. Restore all existing inactive enrollments that have valid enrollment dates
update public.enrollments
set status = 'enrolled',
    updated_at = now()
where status = 'inactive'
  and (enrolled_at is not null or created_at is not null);

-- 2. Update enroll_student_in_cohort: Remove deactivation of other cohorts
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
  v_caller_role text;
  v_target_student_id uuid;
  v_cohort record;
  v_existing_enrollment record;
  v_new_enrollment record;
  v_current_enrollments integer;
  v_enrollment_status text;
  v_effective_fee integer;
  v_payment record;
begin
  if not public.is_active_user() then
    raise exception 'Unauthorized: Account is suspended or inactive.'
      using errcode = '42501';
  end if;

  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null then
    raise exception 'Unauthorized: User profile does not exist.'
      using errcode = '42501';
  end if;

  if p_student_id is not null and p_student_id != auth.uid() then
    if not public.is_admin() then
      raise exception 'Unauthorized: Only administrators can enroll other students.'
        using errcode = '42501';
    end if;
    v_target_student_id := p_student_id;
  else
    v_target_student_id := auth.uid();
  end if;

  select id, title, status, capacity, enrollment_start, enrollment_end, price_inr
  into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort not found.'
      using errcode = 'P0002';
  end if;

  if not public.is_admin() then
    if v_cohort.status not in ('published', 'active') then
      raise exception 'Cohort is not open for enrollment.'
        using errcode = 'P0001';
    end if;

    v_effective_fee := coalesce(v_cohort.price_inr, 4999);
    if v_effective_fee <= 0 then
      raise exception 'Free enrollment is strictly prohibited. Cohort requires payment.'
        using errcode = 'P0001';
    end if;

    select id, status, amount
    into v_payment
    from public.payments
    where user_id = v_target_student_id
      and cohort_id = p_cohort_id
      and status = 'captured';

    if not found then
      raise exception 'Paid enrollment required: No verified payment found for this cohort.'
        using errcode = '42501';
    end if;

    if v_cohort.enrollment_start is not null and now() < v_cohort.enrollment_start then
      raise exception 'Enrollment for this cohort has not started yet.'
        using errcode = 'P0001';
    end if;

    if v_cohort.enrollment_end is not null and now() > v_cohort.enrollment_end then
      raise exception 'Enrollment for this cohort closed on %.', v_cohort.enrollment_end
        using errcode = 'P0001';
    end if;
  end if;

  -- NOTE: We intentionally DO NOT deactivate other cohorts for this student!
  -- Students are permitted to concurrently enroll and learn across multiple paid cohorts.

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
          enrolled_at = coalesce(enrolled_at, now()),
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

grant execute on function public.enroll_student_in_cohort(uuid, uuid) to authenticated;
grant execute on function public.enroll_student_in_cohort(uuid, uuid) to service_role;

-- 3. Update record_successful_cohort_payment: Remove deactivation of other cohorts
create or replace function public.record_successful_cohort_payment(
  p_order_id text,
  p_payment_id text,
  p_signature text,
  p_user_id uuid,
  p_cohort_id uuid,
  p_amount numeric,
  p_currency text default 'INR',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort record;
  v_enrollment record;
  v_payment_record_id uuid;
  v_effective_fee numeric;
  v_payment_status text;
  v_existing_payment record;
begin
  if p_user_id is null or p_cohort_id is null or p_order_id is null or p_payment_id is null then
    raise exception 'Missing required payment verification arguments.'
      using errcode = '42804';
  end if;

  if auth.uid() is not null and auth.uid() != p_user_id and not public.is_admin() then
    raise exception 'Unauthorized payment recording for another student.'
      using errcode = '42501';
  end if;

  select id, title, price_inr, status, enrollment_end
  into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Target cohort % does not exist.', p_cohort_id
      using errcode = 'P0002';
  end if;

  v_effective_fee := coalesce(v_cohort.price_inr, 4999);
  if v_effective_fee <= 0 then
    raise exception 'Platform paid-only policy: Cohort must have a positive fee.'
      using errcode = 'P0001';
  end if;

  if p_amount < v_effective_fee then
    raise exception 'Payment amount % is less than required cohort fee %.', p_amount, v_effective_fee
      using errcode = 'P0001';
  end if;

  select id, status, cohort_id, user_id
  into v_existing_payment
  from public.payments
  where order_id = p_order_id
     or payment_id = p_payment_id;

  if found then
    if v_existing_payment.status = 'captured' and v_existing_payment.user_id = p_user_id and v_existing_payment.cohort_id = p_cohort_id then
      select * into v_enrollment
      from public.enrollments
      where user_id = p_user_id and cohort_id = p_cohort_id;

      return jsonb_build_object(
        'success', true,
        'idempotent', true,
        'message', 'Payment and enrollment already recorded.'
      );
    end if;
  end if;

  insert into public.payments (
    order_id,
    payment_id,
    signature,
    cohort_id,
    user_id,
    amount,
    currency,
    status,
    provider,
    metadata,
    created_at,
    updated_at
  )
  values (
    p_order_id,
    p_payment_id,
    p_signature,
    p_cohort_id,
    p_user_id,
    p_amount,
    coalesce(p_currency, 'INR'),
    'captured',
    'razorpay',
    coalesce(p_metadata, '{}'::jsonb),
    now(),
    now()
  )
  on conflict (order_id) do update
  set payment_id = excluded.payment_id,
      signature = excluded.signature,
      status = 'captured',
      amount = excluded.amount,
      currency = excluded.currency,
      metadata = excluded.metadata,
      updated_at = now()
  returning id into v_payment_record_id;

  -- Upsert Active Student Enrollment without deactivating other cohorts
  insert into public.enrollments (
    user_id,
    cohort_id,
    status,
    created_at,
    enrolled_at,
    updated_at
  )
  values (
    p_user_id,
    p_cohort_id,
    'enrolled',
    now(),
    now(),
    now()
  )
  on conflict (user_id, cohort_id) do update
  set status = 'enrolled',
      enrolled_at = coalesce(public.enrollments.enrolled_at, now()),
      updated_at = now()
  returning * into v_enrollment;

  -- NOTE: We DO NOT deactivate other active cohorts for this student!

  perform public.log_audit_event(
    'payment.verified_and_enrolled',
    'payment',
    v_payment_record_id::text,
    jsonb_build_object(
      'order_id', p_order_id,
      'payment_id', p_payment_id,
      'user_id', p_user_id,
      'cohort_id', p_cohort_id,
      'amount', p_amount,
      'currency', p_currency
    )
  );

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_record_id,
    'enrollment_id', v_enrollment.cohort_id,
    'status', v_enrollment.status
  );
end;
$$;

grant execute on function public.record_successful_cohort_payment(text, text, text, uuid, uuid, numeric, text, jsonb) to authenticated;
grant execute on function public.record_successful_cohort_payment(text, text, text, uuid, uuid, numeric, text, jsonb) to service_role;

-- 4. Update Modules and Lessons RLS to include ('enrolled', 'active', 'completed', 'inactive') for enrolled students
drop policy if exists "Modules select policy" on public.modules;
create policy "Modules select policy"
  on public.modules for select
  to authenticated
  using (
    public.is_admin()
    or (
      cohort_id is not null
      and (
        public.is_mentor_for_cohort(cohort_id)
        or exists (
          select 1 from public.enrollments e
          where e.cohort_id = modules.cohort_id
            and e.user_id = auth.uid()
            and e.status in ('enrolled', 'active', 'completed', 'inactive')
        )
      )
    )
    or (
      cohort_id is null
      and exists (
        select 1 from public.courses co
        where co.id = modules.course_id
          and co.status in ('published', 'active')
      )
    )
  );

drop policy if exists "Lessons select policy" on public.lessons;
create policy "Lessons select policy"
  on public.lessons for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.modules m
      where m.id = lessons.module_id
      and (
        (m.cohort_id is not null and public.is_mentor_for_cohort(m.cohort_id))
        or (
          (lessons.status in ('published', 'review') or lessons.status is null)
          and (
            (
              m.cohort_id is not null
              and exists (
                select 1 from public.enrollments e
                where e.cohort_id = m.cohort_id
                  and e.user_id = auth.uid()
                  and e.status in ('enrolled', 'active', 'completed', 'inactive')
              )
            )
            or (
              m.cohort_id is null
            )
          )
        )
      )
    )
  );

