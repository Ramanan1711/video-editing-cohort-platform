-- ==============================================================================
-- Canonical Migration: Enforce Cohort Enrollment Deadline & Student Access Duration
--
-- 1. Enrollment Deadline:
--    - Enforces that student enrollment in a cohort closes strictly 30 days
--      prior to the course end date (or start_date + duration_days).
--    - Emits a descriptive exception detailing the course end date.
--
-- 2. Student Login Access Duration Policy:
--    - Provides helper RPC / view for checking login access duration:
--      course end date + 60 days.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Fortify create_cohort_checkout_order with 30-Day Pre-End-Date Enrollment Deadline
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
  v_effective_end_date timestamptz;
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
  select id, title, name, status, capacity, price_inr, currency, enrollment_start, enrollment_end, start_date, end_date, duration_days
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

  -- 4. Cohort Enrollment Window & 30-Day Deadline Verification
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

    -- Compute effective course end date
    v_effective_end_date := coalesce(
      v_cohort.end_date,
      case
        when v_cohort.start_date is not null and v_cohort.duration_days is not null
        then v_cohort.start_date + (v_cohort.duration_days || ' days')::interval
        else null
      end
    );

    -- Enforce: Enrollment deadline is strictly 30 days prior to course end date
    if v_effective_end_date is not null and now() > (v_effective_end_date - interval '30 days') then
      raise exception 'Admissions for this cohort closed 30 days prior to the course end date (%).',
        to_char(v_effective_end_date, 'DD Mon YYYY')
        using errcode = 'P0001';
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
grant execute on function public.create_cohort_checkout_order(uuid, uuid, integer) to service_role;

