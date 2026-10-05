-- ==============================================================================
-- Migration: 20261005000001_harden_record_successful_payment_and_enroll.sql
-- Description: Security Audit Remediation — Problem 1: Remove direct client execution
--              of record_successful_payment_and_enroll and enforce authoritative checks.
--
--              1. Explicitly revokes EXECUTE privileges from public, anon, and authenticated roles.
--              2. Grants EXECUTE strictly to the trusted backend service_role.
--              3. Fortifies function with defense-in-depth role check against direct client JWTs.
--              4. Independently verifies authoritative payment state (order existence,
--                 user ownership, cohort match, and authoritative pricing).
--              5. Enforces duplicate enrollment prevention so repeat calls or duplicate
--                 checkout events never produce redundant or corrupted enrollments.
-- ==============================================================================

-- 1. Revoke direct client execution privileges
revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from public;
revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from anon;
revoke execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) from authenticated;

-- 2. Grant exclusively to the trusted backend service role
grant execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) to service_role;

-- 3. Replace function definition with fortified security checks & duplicate prevention
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
  v_jwt_role text;
  v_cohort record;
  v_expected_amount_paise integer;
  v_existing_payment record;
  v_existing_enrollment record;
  v_enrollment record;
begin
  -- [A] Defense-in-depth: Reject direct client invocations even if privileges were misconfigured
  v_jwt_role := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role(), '');
  if v_jwt_role in ('authenticated', 'anon')
     or (
       session_user not in ('postgres', 'service_role', 'supabase_admin')
       and v_jwt_role != 'service_role'
     ) then
    raise exception 'Permission denied: direct client execution of record_successful_payment_and_enroll is prohibited. Only trusted backend service_role may execute.'
      using errcode = '42501';
  end if;

  -- [B] Parameter validation
  if p_order_id is null or trim(p_order_id) = '' then
    raise exception 'Missing required parameter: order_id.' using errcode = 'P0001';
  end if;
  if p_payment_id is null or trim(p_payment_id) = '' then
    raise exception 'Missing required parameter: payment_id.' using errcode = 'P0001';
  end if;
  if p_cohort_id is null then
    raise exception 'Missing required parameter: cohort_id.' using errcode = 'P0001';
  end if;
  if p_user_id is null then
    raise exception 'Missing required parameter: user_id.' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Missing or invalid payment amount.' using errcode = 'P0001';
  end if;

  -- [C] Authoritative Cohort Verification
  select * into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort % does not exist.', p_cohort_id using errcode = 'P0002';
  end if;

  -- Verify amount meets or exceeds authoritative cohort price
  if v_cohort.price_inr is not null and v_cohort.price_inr > 0 then
    v_expected_amount_paise := (v_cohort.price_inr * 100);
    if p_amount < v_expected_amount_paise then
      raise exception 'Payment amount (%) is less than authoritative cohort price (%).', p_amount, v_expected_amount_paise
        using errcode = 'P0004';
    end if;
  end if;

  -- [D] Authoritative Payment State Verification
  select * into v_existing_payment
  from public.payments
  where order_id = p_order_id;

  if found then
    -- Authoritative ownership check
    if v_existing_payment.user_id is not null and v_existing_payment.user_id != p_user_id then
      raise exception 'Payment order does not belong to specified user.' using errcode = '42501';
    end if;

    -- Authoritative cohort scoping check
    if v_existing_payment.cohort_id is not null and v_existing_payment.cohort_id != p_cohort_id then
      raise exception 'Payment order cohort mismatch.' using errcode = 'P0005';
    end if;

    -- Authoritative amount check
    if v_existing_payment.amount is not null and v_existing_payment.amount != p_amount then
      raise exception 'Payment amount does not match authoritative order amount.' using errcode = 'P0006';
    end if;

    -- Idempotency check: If payment already captured
    if v_existing_payment.status = 'captured' then
      -- Check enrollment state
      select * into v_existing_enrollment
      from public.enrollments
      where user_id = p_user_id and cohort_id = p_cohort_id and status in ('enrolled', 'active');

      return jsonb_build_object(
        'success', true,
        'already_processed', true,
        'duplicate_prevented', true,
        'payment_id', coalesce(v_existing_payment.payment_id, p_payment_id),
        'enrollment_id', coalesce(v_existing_enrollment.id::text, p_user_id::text || '_' || p_cohort_id::text),
        'status', 'captured'
      );
    end if;
  end if;

  -- [E] Duplicate Enrollment Prevention Check
  -- Even if this is a first-time payment capture for this order, ensure the student
  -- is not already actively enrolled in this cohort (e.g. from an alternate completed payment)
  select * into v_existing_enrollment
  from public.enrollments
  where user_id = p_user_id
    and cohort_id = p_cohort_id
    and status in ('enrolled', 'active');

  if found then
    -- Update the payment record to captured for bookkeeping & reconciliation
    if v_existing_payment.id is not null then
      update public.payments
      set payment_id = p_payment_id,
          signature = coalesce(p_signature, signature),
          status = 'captured',
          metadata = coalesce(public.payments.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
          updated_at = now()
      where order_id = p_order_id;
    else
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
        now()
      );
    end if;

    -- Audit log duplicate prevention
    perform public.log_audit_event(
      'payment.captured',
      'payment',
      p_payment_id,
      jsonb_build_object(
        'order_id', p_order_id,
        'payment_id', p_payment_id,
        'cohort_id', p_cohort_id,
        'user_id', p_user_id,
        'amount', p_amount,
        'duplicate_enrollment_prevented', true
      )
    );

    return jsonb_build_object(
      'success', true,
      'already_processed', false,
      'duplicate_prevented', true,
      'payment_id', p_payment_id,
      'enrollment_id', coalesce(v_existing_enrollment.id::text, p_user_id::text || '_' || p_cohort_id::text),
      'status', 'captured'
    );
  end if;

  -- [F] Record Captured Payment
  if v_existing_payment.id is not null then
    update public.payments
    set payment_id = p_payment_id,
        signature = coalesce(p_signature, signature),
        status = 'captured',
        metadata = coalesce(public.payments.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
        updated_at = now()
    where order_id = p_order_id;
  else
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
      now()
    );
  end if;

  -- [G] Deactivate conflicting active enrollments (student can only be actively learning in one cohort)
  update public.enrollments
  set status = 'inactive',
      updated_at = now()
  where user_id = p_user_id
    and cohort_id != p_cohort_id
    and status in ('enrolled', 'active');

  -- [H] Upsert Active Cohort Enrollment
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
    p_user_id,
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

  -- [I] Audit Logging
  perform public.log_audit_event(
    'payment.captured',
    'payment',
    p_payment_id,
    jsonb_build_object(
      'order_id', p_order_id,
      'payment_id', p_payment_id,
      'cohort_id', p_cohort_id,
      'user_id', p_user_id,
      'amount', p_amount,
      'currency', p_currency
    )
  );

  perform public.log_audit_event(
    'enrollment.created',
    'enrollment',
    p_user_id::text || ':' || p_cohort_id::text,
    jsonb_build_object(
      'cohort_id', p_cohort_id,
      'student_id', p_user_id,
      'status', 'enrolled',
      'payment_id', p_payment_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'already_processed', false,
    'duplicate_prevented', false,
    'payment_id', p_payment_id,
    'enrollment_id', coalesce(v_enrollment.id::text, p_user_id::text || '_' || p_cohort_id::text),
    'status', 'captured'
  );
end;
$$;
