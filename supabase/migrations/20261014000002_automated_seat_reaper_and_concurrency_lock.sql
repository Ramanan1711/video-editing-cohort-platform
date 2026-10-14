-- Migration: 20261014000002_automated_seat_reaper_and_concurrency_lock.sql
-- Description:
--   1. Friction Point A Remediation:
--      - Grants execution on release_expired_cohort_reservations() to anon, authenticated, and service_role.
--      - Attaches a scheduled pg_cron job executing release_expired_cohort_reservations() every 60 seconds (* * * * *).
--   2. Friction Point B Remediation:
--      - Hardens record_successful_payment_and_enroll by acquiring an immediate FOR UPDATE row lock
--        on public.payments before any other database operations.
--      - Fast-exits immediately with { success: true, already_processed: true } if status = 'captured',
--        preventing concurrent transaction serialization conflicts (SQLSTATE 40001) between
--        client verification RPC and asynchronous Razorpay webhooks.

-- ------------------------------------------------------------------------------
-- 1. Reaper Function & Permissions (Friction Point A)
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

grant execute on function public.release_expired_cohort_reservations() to anon;
grant execute on function public.release_expired_cohort_reservations() to authenticated;
grant execute on function public.release_expired_cohort_reservations() to service_role;

-- ------------------------------------------------------------------------------
-- 2. Automated Scheduled Reaper via pg_cron (every 60s)
-- ------------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    begin
      -- Unschedule if already present to ensure idempotent re-runs
      perform cron.unschedule('reap_expired_cohort_reservations')
      where exists (
        select 1 from cron.job where jobname = 'reap_expired_cohort_reservations'
      );

      perform cron.schedule(
        'reap_expired_cohort_reservations',
        '* * * * *', -- every 60 seconds
        'select public.release_expired_cohort_reservations();'
      );
      raise notice 'Successfully scheduled reap_expired_cohort_reservations via pg_cron';
    exception when others then
      raise notice 'pg_cron schedule attempt raised: %, skipping direct cron registration.', sqlerrm;
    end;
  else
    raise notice 'pg_cron extension not installed in current schema; reaper is triggerable via Edge Function and client checkout hooks.';
  end if;
exception when others then
  raise notice 'pg_cron check skipped: %', sqlerrm;
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. Hardened record_successful_payment_and_enroll (Friction Point B)
-- ------------------------------------------------------------------------------
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
  -- Direct client execution from anonymous or authenticated browser sessions is strictly forbidden.
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

  -- [C] IMMEDIATE ROW LOCK ON TARGET PAYMENT ORDER (Concurrency & Serialization Guard)
  -- Crucial architectural fix for parallel verification race (Client RPC vs. Webhook):
  -- 1. By executing SELECT ... FOR UPDATE immediately, the first incoming execution
  --    (whether client verification or webhook) acquires the exclusive row lock.
  -- 2. The second concurrent transaction blocks at this line waiting for the lock.
  -- 3. When the first transaction commits (status = 'captured'), the second transaction
  --    unblocks and immediately evaluates the idempotency check below.
  -- 4. If status = 'captured', it immediately exits with already_processed = true
  --    WITHOUT attempting any writes or locks on public.enrollments or cohorts,
  --    completely eliminating PostgreSQL serialization conflicts (SQLSTATE 40001).
  select * into v_existing_payment
  from public.payments
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'Payment order % not found in platform records. A prior validated checkout reservation is required.', p_order_id
      using errcode = 'P0002';
  end if;

  -- Idempotency Fast Exit: If order is already captured, cleanly return the existing enrollment immediately
  if v_existing_payment.status = 'captured' then
    select * into v_enrollment
    from public.enrollments
    where user_id = coalesce(v_existing_payment.user_id, p_user_id)
      and cohort_id = coalesce(v_existing_payment.cohort_id, p_cohort_id);

    return jsonb_build_object(
      'success', true,
      'already_processed', true,
      'payment_id', v_existing_payment.id,
      'enrollment_id', coalesce(v_enrollment.user_id, p_user_id),
      'cohort_id', coalesce(v_existing_payment.cohort_id, p_cohort_id),
      'status', 'captured'
    );
  end if;

  -- [D] Ownership, Cohort Scoping, and Stored Reservation Amount Verification
  if v_existing_payment.user_id is not null and v_existing_payment.user_id != p_user_id then
    raise exception 'Payment order does not belong to specified user.' using errcode = '42501';
  end if;

  if v_existing_payment.cohort_id is not null and v_existing_payment.cohort_id != p_cohort_id then
    raise exception 'Payment order cohort mismatch.' using errcode = 'P0005';
  end if;

  if v_existing_payment.amount is not null and v_existing_payment.amount != p_amount then
    raise exception 'Payment amount does not match stored payment order.' using errcode = 'P0004';
  end if;

  v_payment_record_id := v_existing_payment.id;

  -- [E] Authoritative Cohort Verification
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

  -- [F] Student Account Verification
  select * into v_user_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'Student user % does not exist.', p_user_id using errcode = 'P0002';
  end if;

  -- [G] Transition Payment Record to Captured
  update public.payments
  set payment_id = coalesce(p_payment_id, public.payments.payment_id),
      signature = coalesce(p_signature, public.payments.signature),
      status = 'captured',
      amount = p_amount,
      currency = coalesce(p_currency, public.payments.currency, 'INR'),
      metadata = coalesce(public.payments.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'captured_at', now(),
        'verified_amount_paise', p_amount,
        'verified_price_inr', v_cohort.price_inr,
        'signature_present', (p_signature is not null and length(trim(p_signature)) > 0)
      ),
      updated_at = now()
  where id = v_payment_record_id;

  -- [H] Upsert Active Student Enrollment
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

  -- Note: Active enrollments are preserved to support multi-cohort learning.

  -- [I] Durable Audit Log
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

-- Restrict execution solely to trusted backend service_role
revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from public;
revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from anon;
revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from authenticated;
grant execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) to service_role;

