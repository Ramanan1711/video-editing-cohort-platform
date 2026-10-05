-- Migration: 20261005000003_enforce_paid_only_cohort_policy_and_block_free_enrollment.sql
-- Description: Enforce platform paid-only launch policy across backend schemas, RLS policies,
--              and RPC functions. Prevents zero-priced or free cohorts from bypassing checkout.

-- ------------------------------------------------------------------------------
-- 1. Database Schema: Update and Enforce Positive Price Constraint on Cohorts
-- ------------------------------------------------------------------------------

-- Ensure any existing cohort with zero or null price is updated to standard fee
update public.cohorts
set price_inr = 4999
where price_inr is null or price_inr <= 0;

-- Enforce strictly positive price constraint (price_inr > 0)
alter table public.cohorts drop constraint if exists cohorts_price_inr_check;
alter table public.cohorts add constraint cohorts_price_inr_check check (price_inr > 0);

-- Update course-to-cohort sync trigger to ensure positive price default
create or replace function public.sync_course_to_cohort_func()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.title is null and new.name is not null then
    new.title := new.name;
  elsif new.name is null and new.title is not null then
    new.name := new.title;
  end if;

  if new.price_inr is null or new.price_inr <= 0 then
    new.price_inr := 4999;
  end if;

  if new.currency is null or length(trim(new.currency)) = 0 then
    new.currency := 'INR';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. Row Level Security: Fortify Direct Student Enrollment Table Insertion
-- ------------------------------------------------------------------------------

-- Ensure students cannot directly insert into public.enrollments to bypass checkout
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
        select 1 from public.payments
        where user_id = auth.uid()
          and cohort_id = enrollments.cohort_id
          and status = 'captured'
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 3. Fortify enroll_student_in_cohort: Prohibit Free Enrollment & Require Payment
-- ------------------------------------------------------------------------------

drop function if exists public.enroll_student_in_cohort(uuid, uuid);
drop function if exists public.enroll_student_in_cohort(uuid);

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

  -- ENFORCE PAID-ONLY LAUNCH POLICY:
  -- Zero-priced or free cohorts are strictly prohibited from granting enrollment
  if v_cohort.price_inr is null or v_cohort.price_inr <= 0 then
    raise exception 'Free enrollment is prohibited under the platform paid-only policy. Cohorts must have an authoritative positive price.'
      using errcode = 'P0003';
  end if;

  -- For non-admin callers, a captured payment is mandatory
  if not (public.is_admin() and public.is_active_user()) then
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

grant execute on function public.enroll_student_in_cohort(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 4. Fortify create_cohort_checkout_order: Block Zero-Priced Cohort Checkout
-- ------------------------------------------------------------------------------

drop function if exists public.create_cohort_checkout_order(uuid, uuid, integer);

create or replace function public.create_cohort_checkout_order(
  p_cohort_id uuid,
  p_user_id uuid default null,
  p_ttl_minutes integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user_id uuid;
  v_cohort record;
  v_active_enrollments integer;
  v_pending_reservations integer;
  v_effective_ttl integer;
  v_reservation_id uuid;
  v_provisional_order_id text;
  v_receipt text;
  v_amount_paise integer;
  v_currency text;
  v_expires_at timestamptz;
  v_payment record;
begin
  -- 1. Authentication & Authorization Check
  v_target_user_id := coalesce(p_user_id, auth.uid());

  if v_target_user_id is null then
    raise exception 'Authentication required to initiate checkout.' using errcode = '42501';
  end if;

  if v_target_user_id != auth.uid() and not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: You cannot initiate checkout for another user.' using errcode = '42501';
  end if;

  -- 2. User Account Status Check
  if not exists (
    select 1 from public.profiles
    where id = v_target_user_id and coalesce(status, 'active') = 'active'
  ) then
    raise exception 'Account is suspended or inactive.' using errcode = 'P0001';
  end if;

  -- 3. Atomic Cohort Locking (FOR UPDATE)
  select id, title, name, status, capacity, price_inr, currency, enrollment_start, enrollment_end
  into v_cohort
  from public.cohorts
  where id = p_cohort_id
  for update;

  if not found then
    raise exception 'Cohort % not found.', p_cohort_id using errcode = 'P0002';
  end if;

  -- ENFORCE PAID-ONLY LAUNCH POLICY:
  -- Prohibit zero-priced or free cohort checkout initialization
  if v_cohort.price_inr is null or v_cohort.price_inr <= 0 then
    raise exception 'Checkout cannot be initiated for a free or zero-priced cohort. Paid-only launch policy enforced.'
      using errcode = 'P0003';
  end if;

  -- 4. Cohort Enrollment Window Verification
  if not (public.is_admin() and public.is_active_user()) then
    if v_cohort.status not in ('published', 'active') then
      raise exception 'Cohort is not open for enrollment.' using errcode = 'P0001';
    end if;

    if v_cohort.enrollment_start is not null and now() < v_cohort.enrollment_start then
      raise exception 'Cohort enrollment has not opened yet.' using errcode = 'P0001';
    end if;

    if v_cohort.enrollment_end is not null and now() > v_cohort.enrollment_end then
      raise exception 'Cohort enrollment has closed.' using errcode = 'P0001';
    end if;
  end if;

  -- 5. Student Already Enrolled Check
  if exists (
    select 1 from public.enrollments
    where user_id = v_target_user_id
      and cohort_id = p_cohort_id
      and status in ('enrolled', 'active')
  ) then
    raise exception 'You are already actively enrolled in this cohort.' using errcode = 'P0001';
  end if;

  -- 6. Proactive Cohort-Scoped Reservation Expiry
  update public.payments
  set status = 'failed',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'expired_at', now(),
        'expired_reason', 'reservation_ttl_elapsed'
      ),
      updated_at = now()
  where cohort_id = p_cohort_id
    and status = 'created'
    and expires_at <= now();

  -- 7. Supersede any stale pending reservation by this same student for this cohort
  update public.payments
  set status = 'failed',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'superseded_at', now(),
        'superseded_reason', 'new_checkout_attempt_initiated'
      ),
      updated_at = now()
  where cohort_id = p_cohort_id
    and user_id = v_target_user_id
    and status = 'created';

  -- 8. Capacity Check: Confirmed Enrollments + Active Unexpired Reservations
  select count(*) into v_active_enrollments
  from public.enrollments
  where cohort_id = p_cohort_id and status in ('enrolled', 'active');

  select count(*) into v_pending_reservations
  from public.payments
  where cohort_id = p_cohort_id
    and status = 'created'
    and expires_at > now()
    and user_id != v_target_user_id;

  if v_cohort.capacity is not null and (v_active_enrollments + v_pending_reservations) >= v_cohort.capacity then
    raise exception 'Cohort capacity reached. No seats currently available.' using errcode = 'P0002';
  end if;

  -- 9. Atomic Reservation Creation with positive price
  v_effective_ttl := greatest(1, least(coalesce(p_ttl_minutes, 15), 60));
  v_reservation_id := gen_random_uuid();
  v_provisional_order_id := 'resv_' || replace(v_reservation_id::text, '-', '');
  v_receipt := 'rcpt_' || substring(v_target_user_id::text from 1 for 8) || '_' || cast(extract(epoch from now()) * 1000 as bigint);
  v_amount_paise := v_cohort.price_inr * 100;
  v_currency := coalesce(v_cohort.currency, 'INR');
  v_expires_at := now() + (interval '1 minute' * v_effective_ttl);

  insert into public.payments (
    id,
    order_id,
    cohort_id,
    user_id,
    amount,
    currency,
    status,
    provider,
    receipt,
    expires_at,
    metadata,
    created_at,
    updated_at
  )
  values (
    v_reservation_id,
    v_provisional_order_id,
    p_cohort_id,
    v_target_user_id,
    v_amount_paise,
    v_currency,
    'created',
    'razorpay',
    v_receipt,
    v_expires_at,
    jsonb_build_object(
      'is_capacity_reservation', true,
      'ttl_minutes', v_effective_ttl,
      'provisional_created_at', now(),
      'cohort_title', coalesce(v_cohort.title, v_cohort.name),
      'cohort_price_inr', v_cohort.price_inr,
      'reservation_id', v_reservation_id
    ),
    now(),
    now()
  )
  returning * into v_payment;

  return jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'provisional_order_id', v_provisional_order_id,
    'amount_paise', v_amount_paise,
    'price_inr', v_cohort.price_inr,
    'currency', v_currency,
    'receipt', v_receipt,
    'expires_at', v_expires_at,
    'ttl_minutes', v_effective_ttl,
    'cohort_id', p_cohort_id,
    'title', coalesce(v_cohort.title, v_cohort.name)
  );
end;
$$;

grant execute on function public.create_cohort_checkout_order(uuid, uuid, integer) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. Fortify record_successful_payment_and_enroll: Enforce Positive Cohort Price
-- ------------------------------------------------------------------------------

drop function if exists public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb);

create or replace function public.record_successful_payment_and_enroll(
  p_order_id text,
  p_payment_id text,
  p_signature text,
  p_cohort_id uuid,
  p_user_id uuid,
  p_amount integer,
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
  v_existing_payment record;
  v_user_profile record;
  v_enrollment record;
  v_expected_amount_paise integer;
  v_payment_record_id uuid;
begin
  -- [A] Authentication and Caller Privilege Guard
  if coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated') then
    raise exception 'Permission denied: direct client execution of record_successful_payment_and_enroll is prohibited. Only trusted backend service_role may execute.'
      using errcode = '42501';
  end if;

  -- [B] Parameter Integrity Checks
  if p_order_id is null or length(trim(p_order_id)) = 0 then
    raise exception 'Missing required parameter: p_order_id' using errcode = 'P0001';
  end if;

  if p_payment_id is null or length(trim(p_payment_id)) = 0 then
    raise exception 'Missing required parameter: p_payment_id' using errcode = 'P0001';
  end if;

  if p_user_id is null then
    raise exception 'Missing required parameter: p_user_id' using errcode = 'P0001';
  end if;

  if p_cohort_id is null then
    raise exception 'Missing required parameter: p_cohort_id' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero. Free enrollment is prohibited.' using errcode = 'P0001';
  end if;

  -- [C] Authoritative Cohort Verification
  select * into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort % does not exist.', p_cohort_id using errcode = 'P0002';
  end if;

  -- ENFORCE PAID-ONLY LAUNCH POLICY:
  -- Cohort must have a positive price and payment amount must meet it
  if v_cohort.price_inr is null or v_cohort.price_inr <= 0 then
    raise exception 'Cohort must have a valid positive paid price. Free enrollment is prohibited.'
      using errcode = 'P0004';
  end if;

  v_expected_amount_paise := (v_cohort.price_inr * 100);
  if p_amount < v_expected_amount_paise then
    raise exception 'Payment amount (%) is less than authoritative cohort price (%).', p_amount, v_expected_amount_paise
      using errcode = 'P0004';
  end if;

  -- [D] Authoritative Payment State Verification
  select * into v_existing_payment
  from public.payments
  where order_id = p_order_id;

  if found then
    if v_existing_payment.user_id is not null and v_existing_payment.user_id != p_user_id then
      raise exception 'Payment order does not belong to specified user.' using errcode = '42501';
    end if;

    if v_existing_payment.cohort_id is not null and v_existing_payment.cohort_id != p_cohort_id then
      raise exception 'Payment order cohort mismatch.' using errcode = 'P0005';
    end if;

    if v_existing_payment.amount is not null and v_existing_payment.amount != p_amount then
      raise exception 'Payment amount does not match stored payment order.' using errcode = 'P0004';
    end if;

    if v_existing_payment.status = 'captured' then
      select * into v_enrollment
      from public.enrollments
      where user_id = p_user_id and cohort_id = p_cohort_id;

      return jsonb_build_object(
        'success', true,
        'already_processed', true,
        'payment_id', v_existing_payment.id,
        'enrollment_id', v_enrollment.user_id,
        'cohort_id', p_cohort_id,
        'status', 'captured'
      );
    end if;

    v_payment_record_id := v_existing_payment.id;
  else
    v_payment_record_id := gen_random_uuid();
  end if;

  -- [E] Student Account Verification
  select * into v_user_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'Student user % does not exist.', p_user_id using errcode = 'P0002';
  end if;

  -- [F] Upsert Payment Record as Captured
  insert into public.payments (
    id,
    order_id,
    payment_id,
    signature,
    user_id,
    cohort_id,
    amount,
    currency,
    status,
    provider,
    metadata,
    created_at,
    updated_at
  )
  values (
    v_payment_record_id,
    p_order_id,
    p_payment_id,
    p_signature,
    p_user_id,
    p_cohort_id,
    p_amount,
    coalesce(p_currency, 'INR'),
    'captured',
    'razorpay',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'captured_at', now(),
      'verified_amount_paise', p_amount,
      'verified_price_inr', v_cohort.price_inr,
      'signature_present', (p_signature is not null and length(trim(p_signature)) > 0)
    ),
    now(),
    now()
  )
  on conflict (order_id) do update
  set payment_id = excluded.payment_id,
      signature = excluded.signature,
      status = 'captured',
      amount = excluded.amount,
      currency = excluded.currency,
      metadata = public.payments.metadata || excluded.metadata,
      updated_at = now()
  returning id into v_payment_record_id;

  -- [G] Upsert Active Student Enrollment
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

  -- Deactivate any other active cohorts for this student
  update public.enrollments
  set status = 'inactive',
      updated_at = now()
  where user_id = p_user_id
    and cohort_id != p_cohort_id
    and status in ('enrolled', 'active');

  -- [H] Durable Audit Log
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
    'enrollment_id', v_enrollment.user_id,
    'cohort_id', p_cohort_id,
    'status', 'captured'
  );
end;
$$;

revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from public;
revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from anon;
revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from authenticated;
grant execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) to service_role;

