-- Migration: 20261006000001_harden_payment_order_lookup_and_concurrency.sql
-- Description: Harden record_successful_payment_and_enroll RPC against unreserved orders
--              and concurrency race conditions. Closes database-level defense-in-depth gap
--              by strictly requiring a pre-existing order in public.payments (FOR UPDATE).

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

  -- [D] Authoritative Payment State Verification with Concurrency Row Lock
  -- DEFENSE-IN-DEPTH HARDENING:
  -- 1. Strictly require that p_order_id already exists in public.payments.
  --    Arbitrary or unreserved orders are rejected with P0002.
  -- 2. Lock the row FOR UPDATE to eliminate concurrency race conditions
  --    between concurrent webhook deliveries and client verification requests.
  select * into v_existing_payment
  from public.payments
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'Payment order % not found in platform records. A prior validated checkout reservation is required.', p_order_id
      using errcode = 'P0002';
  end if;

  -- User ownership check
  if v_existing_payment.user_id is not null and v_existing_payment.user_id != p_user_id then
    raise exception 'Payment order does not belong to specified user.' using errcode = '42501';
  end if;

  -- Cohort scoping check
  if v_existing_payment.cohort_id is not null and v_existing_payment.cohort_id != p_cohort_id then
    raise exception 'Payment order cohort mismatch.' using errcode = 'P0005';
  end if;

  -- Amount check against stored reservation
  if v_existing_payment.amount is not null and v_existing_payment.amount != p_amount then
    raise exception 'Payment amount does not match stored payment order.' using errcode = 'P0004';
  end if;

  -- Idempotency check: If order is already captured, cleanly return the existing enrollment
  if v_existing_payment.status = 'captured' then
    select * into v_enrollment
    from public.enrollments
    where user_id = p_user_id and cohort_id = p_cohort_id;

    return jsonb_build_object(
      'success', true,
      'already_processed', true,
      'payment_id', v_existing_payment.id,
      'enrollment_id', coalesce(v_enrollment.user_id, p_user_id),
      'cohort_id', p_cohort_id,
      'status', 'captured'
    );
  end if;

  v_payment_record_id := v_existing_payment.id;

  -- [E] Student Account Verification
  select * into v_user_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'Student user % does not exist.', p_user_id using errcode = 'P0002';
  end if;

  -- [F] Transition Payment Record to Captured
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

  -- Deactivate any other active cohorts for this student to maintain single active cohort policy
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

-- Restrict execution solely to trusted backend service_role
revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from public;
revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from anon;
revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from authenticated;
grant execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) to service_role;

