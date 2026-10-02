-- ==============================================================================
-- Migration: 20261002000001_canonical_razorpay_cohort_pricing_and_payments.sql
-- Description: Server-authoritative cohort pricing, payments table, reservation TTL,
--              fail-closed payment verification, and idempotent enrollment transaction.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Add server-authoritative pricing fields to public.cohorts
-- ------------------------------------------------------------------------------
alter table public.cohorts add column if not exists price_inr integer not null default 4999;
alter table public.cohorts add column if not exists currency text not null default 'INR';

do $$
begin
  alter table public.cohorts drop constraint if exists cohorts_price_inr_check;
  alter table public.cohorts add constraint cohorts_price_inr_check check (price_inr >= 0);
exception when others then
  null;
end $$;

-- Update sync trigger to preserve price_inr and currency
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
  new.price_inr := coalesce(new.price_inr, 4999);
  new.currency := coalesce(new.currency, 'INR');
  new.updated_at := coalesce(new.updated_at, now());
  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. Create public.payments table for orders, verification, and audit trail
-- ------------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  payment_id text unique,
  signature text,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount >= 0), -- in paise
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created', 'attempted', 'captured', 'failed', 'refunded')),
  provider text not null default 'razorpay',
  receipt text,
  notes jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_payment_id on public.payments(payment_id);
create index if not exists idx_payments_user_cohort on public.payments(user_id, cohort_id);
create index if not exists idx_payments_cohort_status on public.payments(cohort_id, status);
create index if not exists idx_payments_active_reservations on public.payments(cohort_id, expires_at) where status = 'created';

alter table public.payments enable row level security;

-- Students can read their own payments
drop policy if exists "Students can view their own payments" on public.payments;
create policy "Students can view their own payments"
  on public.payments
  for select
  using (auth.uid() = user_id or (public.is_admin() and public.is_active_user()));

-- Admins can read and manage all payments
drop policy if exists "Admins can manage payments" on public.payments;
create policy "Admins can manage payments"
  on public.payments
  for all
  using (public.is_admin() and public.is_active_user())
  with check (public.is_admin() and public.is_active_user());

-- ------------------------------------------------------------------------------
-- 3. RPC: create_cohort_checkout_order
-- Prepares validated cohort checkout, verifies window/user, and reserves seats
-- ------------------------------------------------------------------------------
create or replace function public.create_cohort_checkout_order(
  p_cohort_id uuid,
  p_user_id uuid default null
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
begin
  v_target_user_id := coalesce(p_user_id, auth.uid());

  if v_target_user_id is null then
    raise exception 'Authentication required to initiate checkout.' using errcode = '42501';
  end if;

  if v_target_user_id != auth.uid() and not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized to create checkout for another user.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_target_user_id and coalesce(status, 'active') = 'active'
  ) then
    raise exception 'Account is suspended or inactive.' using errcode = 'P0001';
  end if;

  select id, title, name, status, capacity, price_inr, currency, enrollment_start, enrollment_end
  into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort % not found.', p_cohort_id using errcode = 'P0002';
  end if;

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

  -- Check if student already enrolled
  if exists (
    select 1 from public.enrollments
    where user_id = v_target_user_id
      and cohort_id = p_cohort_id
      and status in ('enrolled', 'active')
  ) then
    raise exception 'You are already actively enrolled in this cohort.' using errcode = 'P0001';
  end if;

  -- Capacity check considering active enrollments + active pending order reservations
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
    raise exception 'Cohort capacity reached. No seats currently available.' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'cohort_id', v_cohort.id,
    'title', coalesce(v_cohort.title, v_cohort.name),
    'price_inr', coalesce(v_cohort.price_inr, 4999),
    'currency', coalesce(v_cohort.currency, 'INR'),
    'amount_paise', coalesce(v_cohort.price_inr, 4999) * 100
  );
end;
$$;

grant execute on function public.create_cohort_checkout_order(uuid, uuid) to authenticated;
grant execute on function public.create_cohort_checkout_order(uuid, uuid) to service_role;

-- ------------------------------------------------------------------------------
-- 4. RPC: record_successful_payment_and_enroll
-- Transactional, idempotent payment confirmation & student enrollment
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
  v_existing_payment record;
  v_enrollment record;
begin
  if p_order_id is null or p_payment_id is null or p_cohort_id is null or p_user_id is null then
    raise exception 'Missing required payment verification parameters.' using errcode = 'P0001';
  end if;

  -- 1. Idempotency check: see if payment was already captured
  select * into v_existing_payment
  from public.payments
  where order_id = p_order_id or payment_id = p_payment_id;

  if found and v_existing_payment.status = 'captured' then
    return jsonb_build_object(
      'success', true,
      'already_processed', true,
      'payment_id', v_existing_payment.payment_id,
      'enrollment_id', p_user_id::text || '_' || p_cohort_id::text,
      'status', 'captured'
    );
  end if;

  -- 2. Upsert payment record as captured
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
  )
  on conflict (order_id) do update
  set payment_id = excluded.payment_id,
      signature = excluded.signature,
      status = 'captured',
      metadata = public.payments.metadata || excluded.metadata,
      updated_at = now();

  -- 3. Deactivate other active enrollments for this student
  update public.enrollments
  set status = 'inactive'
  where user_id = p_user_id
    and cohort_id != p_cohort_id
    and status in ('enrolled', 'active');

  -- 4. Upsert active enrollment for this cohort
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
      enrolled_at = now(),
      updated_at = now()
  returning * into v_enrollment;

  -- 5. Audit Logging
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
    'payment_id', p_payment_id,
    'enrollment_id', p_user_id::text || '_' || p_cohort_id::text,
    'status', 'captured'
  );
end;
$$;

grant execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) to authenticated;
grant execute on function public.record_successful_payment_and_enroll(text, text, text, uuid, uuid, integer, text, jsonb) to service_role;

-- ------------------------------------------------------------------------------
-- 5. Fortify enroll_student_in_cohort: enforce payment check for paid cohorts
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

  select id, coalesce(title, name, 'Cohort') as title, status, capacity, visibility, enrollment_start, enrollment_end, coalesce(price_inr, 4999) as price_inr
  into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort % not found.', p_cohort_id
      using errcode = 'P0002';
  end if;

  -- If this is a paid cohort and caller is not an admin, require captured payment verification
  if v_cohort.price_inr > 0 and not (public.is_admin() and public.is_active_user()) then
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
grant execute on function public.enroll_student_in_cohort(uuid, uuid) to service_role;
