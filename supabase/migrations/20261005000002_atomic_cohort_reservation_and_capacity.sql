-- ==============================================================================
-- Migration: 20261005000002_atomic_cohort_reservation_and_capacity.sql
-- Description: Security Audit Remediation — Problem 5: Atomic Cohort Capacity Reservation
--              and Race Condition Elimination.
--
--              1. Atomically reserves capacity inside a single database transaction
--                 using an exclusive row lock (`SELECT ... FOR UPDATE`) on public.cohorts.
--              2. Proactively reaps/expires overdue pending reservations (TTL: 15 minutes),
--                 ensuring abandoned checkout attempts never permanently consume seats.
--              3. Strictly accounts for confirmed enrollments (`status IN ('enrolled', 'active')`)
--                 and unexpired pending reservations (`status = 'created' AND expires_at > now()`).
--              4. Atomically records the reservation in public.payments before returning,
--                 preventing concurrent requests from overselling the cohort.
--              5. Provides cancel_cohort_checkout_reservation RPC to immediately release
--                 capacity upon user dismissal or failed payment.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper function to release all expired checkout reservations platform-wide
-- ------------------------------------------------------------------------------
create or replace function public.release_expired_cohort_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.payments
  set status = 'failed',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'expired_at', now(),
        'expired_reason', 'reservation_ttl_elapsed'
      ),
      updated_at = now()
  where status = 'created'
    and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.release_expired_cohort_reservations() to authenticated;
grant execute on function public.release_expired_cohort_reservations() to service_role;

-- ------------------------------------------------------------------------------
-- 2. Atomic Reservation RPC: create_cohort_checkout_order
--    Acquires exclusive cohort row lock, expires old reservations, verifies capacity,
--    and atomically inserts the reservation record in public.payments.
-- ------------------------------------------------------------------------------
-- Explicitly drop prior signatures to prevent PostgreSQL error 42P13 (cannot remove parameter defaults)
drop function if exists public.create_cohort_checkout_order(uuid, uuid);
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
begin
  -- 1. Identity & Permissions Verification
  v_target_user_id := coalesce(p_user_id, auth.uid());

  if v_target_user_id is null then
    raise exception 'Authentication required to initiate checkout.' using errcode = '42501';
  end if;

  if v_target_user_id != auth.uid() and not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized to create checkout for another user.' using errcode = '42501';
  end if;

  -- 2. User Account Status Check
  if not exists (
    select 1 from public.profiles
    where id = v_target_user_id and coalesce(status, 'active') = 'active'
  ) then
    raise exception 'Account is suspended or inactive.' using errcode = 'P0001';
  end if;

  -- 3. Atomic Cohort Locking (FOR UPDATE)
  -- Serializes concurrent checkout requests for the same cohort to eliminate race conditions.
  select id, title, name, status, capacity, price_inr, currency, enrollment_start, enrollment_end
  into v_cohort
  from public.cohorts
  where id = p_cohort_id
  for update;

  if not found then
    raise exception 'Cohort % not found.', p_cohort_id using errcode = 'P0002';
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
  -- Releases seats from abandoned checkout attempts whose TTL has elapsed.
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

  -- 9. Atomic Reservation Creation
  v_effective_ttl := greatest(1, least(coalesce(p_ttl_minutes, 15), 60));
  v_reservation_id := gen_random_uuid();
  v_provisional_order_id := 'resv_' || replace(v_reservation_id::text, '-', '');
  v_receipt := 'rcpt_' || substring(v_target_user_id::text from 1 for 8) || '_' || cast(extract(epoch from now()) * 1000 as bigint);
  v_amount_paise := coalesce(v_cohort.price_inr, 4999) * 100;
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
    notes,
    metadata,
    expires_at,
    created_at,
    updated_at
  ) values (
    v_reservation_id,
    v_provisional_order_id,
    p_cohort_id,
    v_target_user_id,
    v_amount_paise,
    v_currency,
    'created',
    'razorpay',
    v_receipt,
    jsonb_build_object(
      'cohort_id', p_cohort_id,
      'cohort_title', coalesce(v_cohort.title, v_cohort.name),
      'user_id', v_target_user_id
    ),
    jsonb_build_object(
      'reservation_source', 'create_cohort_checkout_order',
      'reserved_at', now(),
      'cohort_price_inr', coalesce(v_cohort.price_inr, 4999),
      'ttl_minutes', v_effective_ttl
    ),
    v_expires_at,
    now(),
    now()
  );

  return jsonb_build_object(
    'reservation_id', v_reservation_id,
    'provisional_order_id', v_provisional_order_id,
    'receipt', v_receipt,
    'cohort_id', v_cohort.id,
    'title', coalesce(v_cohort.title, v_cohort.name),
    'price_inr', coalesce(v_cohort.price_inr, 4999),
    'currency', v_currency,
    'amount_paise', v_amount_paise,
    'expires_at', v_expires_at,
    'remaining_capacity', case when v_cohort.capacity is not null then greatest(0, v_cohort.capacity - (v_active_enrollments + v_pending_reservations + 1)) else null end
  );
end;
$$;

grant execute on function public.create_cohort_checkout_order(uuid, uuid, integer) to authenticated;
grant execute on function public.create_cohort_checkout_order(uuid, uuid, integer) to service_role;

-- ------------------------------------------------------------------------------
-- 3. Immediate Reservation Cancellation RPC
--    Releases capacity immediately upon client dismissal or failure
-- ------------------------------------------------------------------------------
drop function if exists public.cancel_cohort_checkout_reservation(text, uuid);

create or replace function public.cancel_cohort_checkout_reservation(
  p_order_id text,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user_id uuid;
  v_payment record;
begin
  v_target_user_id := coalesce(p_user_id, auth.uid());

  select * into v_payment
  from public.payments
  where order_id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Payment reservation not found');
  end if;

  if v_payment.user_id != v_target_user_id and not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized to cancel this reservation.' using errcode = '42501';
  end if;

  if v_payment.status = 'created' then
    update public.payments
    set status = 'failed',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'cancelled_at', now(),
          'cancellation_reason', 'client_dismissed'
        ),
        updated_at = now()
    where id = v_payment.id;

    return jsonb_build_object('success', true, 'status', 'cancelled', 'released_cohort_id', v_payment.cohort_id);
  end if;

  return jsonb_build_object('success', true, 'status', v_payment.status, 'already_resolved', true);
end;
$$;

grant execute on function public.cancel_cohort_checkout_reservation(text, uuid) to authenticated;
grant execute on function public.cancel_cohort_checkout_reservation(text, uuid) to service_role;
