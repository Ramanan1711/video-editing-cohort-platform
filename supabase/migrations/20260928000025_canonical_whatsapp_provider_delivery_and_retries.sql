-- ==============================================================================
-- Migration: 20260928000025_canonical_whatsapp_provider_delivery_and_retries.sql
-- Description: Canonical WhatsApp Automated Provider Integration, Delivery Tracking & Retries
-- Scope:
--   1. Schema enhancements to public.whatsapp_notifications_log:
--      - provider ('meta', 'twilio', 'webhook', 'mock', 'manual')
--      - provider_message_id (external message ID)
--      - cohort_id foreign key referencing public.cohorts
--      - retry_count, max_retries, next_retry_at
--      - sent_at, delivered_at, read_at
--      - idempotency_key with unique partial index
--      - metadata jsonb
--      - updated status check constraint ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled')
--   2. Performance indexes on status, retry queue, cohort_id, and provider_message_id
--   3. Row-Level Security (RLS) policies for user viewing, mentor/admin updates & retries
--   4. Authoritative Stored Procedures:
--      - dispatch_whatsapp_message: opt-in validation, idempotency, and log creation
--      - update_whatsapp_delivery_status: webhook status updates and timestamp tracking
--      - record_whatsapp_retry_attempt: exponential backoff calculation and retry lifecycle
--      - get_pending_whatsapp_retries: batch retrieval for automated retry workers
--      - get_cohort_whatsapp_stats: cohort delivery KPIs and aggregation
-- ==============================================================================

-- 1. Extend public.whatsapp_notifications_log schema
do $$
begin
  -- Add cohort_id
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'whatsapp_notifications_log' and column_name = 'cohort_id'
  ) then
    alter table public.whatsapp_notifications_log
      add column cohort_id uuid references public.cohorts(id) on delete set null;
  end if;

  -- Add provider
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'whatsapp_notifications_log' and column_name = 'provider'
  ) then
    alter table public.whatsapp_notifications_log
      add column provider text not null default 'mock';
  end if;

  -- Add provider_message_id
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'whatsapp_notifications_log' and column_name = 'provider_message_id'
  ) then
    alter table public.whatsapp_notifications_log
      add column provider_message_id text;
  end if;

  -- Add retry tracking columns
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'whatsapp_notifications_log' and column_name = 'retry_count'
  ) then
    alter table public.whatsapp_notifications_log
      add column retry_count integer not null default 0,
      add column max_retries integer not null default 3,
      add column next_retry_at timestamptz;
  end if;

  -- Add delivery timestamps
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'whatsapp_notifications_log' and column_name = 'sent_at'
  ) then
    alter table public.whatsapp_notifications_log
      add column sent_at timestamptz,
      add column delivered_at timestamptz,
      add column read_at timestamptz;
  end if;

  -- Add idempotency_key
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'whatsapp_notifications_log' and column_name = 'idempotency_key'
  ) then
    alter table public.whatsapp_notifications_log
      add column idempotency_key text;
  end if;

  -- Add metadata
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'whatsapp_notifications_log' and column_name = 'metadata'
  ) then
    alter table public.whatsapp_notifications_log
      add column metadata jsonb not null default '{}'::jsonb;
  end if;
end $$;

-- 2. Update status constraint to include full delivery lifecycle
alter table public.whatsapp_notifications_log
  drop constraint if exists whatsapp_notifications_log_status_check;

alter table public.whatsapp_notifications_log
  add constraint whatsapp_notifications_log_status_check
  check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled'));

-- Update provider constraint
alter table public.whatsapp_notifications_log
  drop constraint if exists whatsapp_notifications_log_provider_check;

alter table public.whatsapp_notifications_log
  add constraint whatsapp_notifications_log_provider_check
  check (provider in ('meta', 'twilio', 'webhook', 'mock', 'manual'));

-- 3. Indexes for Delivery Tracking & Retry Processing
create index if not exists idx_wa_log_cohort
  on public.whatsapp_notifications_log(cohort_id);

create index if not exists idx_wa_log_status
  on public.whatsapp_notifications_log(status);

create index if not exists idx_wa_log_provider_msg
  on public.whatsapp_notifications_log(provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_wa_log_retry_queue
  on public.whatsapp_notifications_log(status, next_retry_at)
  where status in ('queued', 'failed');

create unique index if not exists idx_wa_log_idempotency
  on public.whatsapp_notifications_log(idempotency_key)
  where idempotency_key is not null;

-- 4. Row Level Security Policies
alter table public.whatsapp_notifications_log enable row level security;

-- Students can read their own message logs
drop policy if exists "Users can view their own WhatsApp message logs" on public.whatsapp_notifications_log;
create policy "Users can view their own WhatsApp message logs"
  on public.whatsapp_notifications_log for select
  to authenticated
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'mentor')
    )
  );

-- System and authenticated users can insert logs
drop policy if exists "System and Admins can record WhatsApp messages" on public.whatsapp_notifications_log;
create policy "System and Admins can record WhatsApp messages"
  on public.whatsapp_notifications_log for insert
  to authenticated
  with check (true);

-- Mentors and Admins can update logs (delivery receipts, status changes, retries)
drop policy if exists "Mentors and Admins can update WhatsApp message logs" on public.whatsapp_notifications_log;
create policy "Mentors and Admins can update WhatsApp message logs"
  on public.whatsapp_notifications_log for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'mentor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'mentor')
    )
  );

-- 5. Authoritative Stored Procedures

-- Procedure 1: Dispatch WhatsApp Message (with Opt-in and Idempotency Enforcement)
create or replace function public.dispatch_whatsapp_message(
  p_user_id uuid,
  p_cohort_id uuid,
  p_recipient_phone text,
  p_event_type text,
  p_message_body text,
  p_provider text default 'mock',
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns public.whatsapp_notifications_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opt_in boolean := true;
  v_clean_phone text;
  v_existing_log public.whatsapp_notifications_log;
  v_new_log public.whatsapp_notifications_log;
begin
  -- 1. Check idempotency if key provided
  if p_idempotency_key is not null and p_idempotency_key <> '' then
    select * into v_existing_log
    from public.whatsapp_notifications_log
    where idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return v_existing_log;
    end if;
  end if;

  -- 2. Verify user opt-in if user_id is provided
  if p_user_id is not null then
    select coalesce(whatsapp_opt_in, true) into v_opt_in
    from public.profiles
    where id = p_user_id;

    if not v_opt_in then
      -- Record as cancelled due to opt-out
      insert into public.whatsapp_notifications_log (
        user_id,
        cohort_id,
        recipient_phone,
        event_type,
        message_body,
        provider,
        status,
        error_details,
        idempotency_key,
        metadata
      ) values (
        p_user_id,
        p_cohort_id,
        regexp_replace(p_recipient_phone, '[^0-9]', '', 'g'),
        p_event_type,
        p_message_body,
        p_provider,
        'cancelled',
        'Recipient opted out of WhatsApp notifications',
        p_idempotency_key,
        p_metadata
      )
      returning * into v_new_log;

      return v_new_log;
    end if;
  end if;

  -- 3. Clean recipient phone
  v_clean_phone := regexp_replace(p_recipient_phone, '[^0-9]', '', 'g');

  -- 4. Insert queued message log
  insert into public.whatsapp_notifications_log (
    user_id,
    cohort_id,
    recipient_phone,
    event_type,
    message_body,
    provider,
    status,
    idempotency_key,
    metadata,
    created_at
  ) values (
    p_user_id,
    p_cohort_id,
    v_clean_phone,
    p_event_type,
    p_message_body,
    p_provider,
    'queued',
    p_idempotency_key,
    p_metadata,
    now()
  )
  returning * into v_new_log;

  return v_new_log;
end;
$$;

-- Procedure 2: Update WhatsApp Delivery Status (from Webhook or Polling)
create or replace function public.update_whatsapp_delivery_status(
  p_log_id uuid,
  p_provider_message_id text default null,
  p_status text default 'sent',
  p_error_details text default null,
  p_delivered_at timestamptz default null,
  p_read_at timestamptz default null
)
returns public.whatsapp_notifications_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated public.whatsapp_notifications_log;
begin
  update public.whatsapp_notifications_log
  set
    status = p_status,
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    error_details = p_error_details,
    sent_at = case when p_status = 'sent' and sent_at is null then now() else sent_at end,
    delivered_at = coalesce(p_delivered_at, case when p_status in ('delivered', 'read') and delivered_at is null then now() else delivered_at end),
    read_at = coalesce(p_read_at, case when p_status = 'read' and read_at is null then now() else read_at end)
  where id = p_log_id
  returning * into v_updated;

  return v_updated;
end;
$$;

-- Procedure 3: Record Retry Attempt with Exponential Backoff
create or replace function public.record_whatsapp_retry_attempt(
  p_log_id uuid,
  p_success boolean,
  p_error_details text default null,
  p_provider_message_id text default null
)
returns public.whatsapp_notifications_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.whatsapp_notifications_log;
  v_new_retry_count integer;
  v_next_retry timestamptz;
  v_final_status text;
begin
  select * into v_log
  from public.whatsapp_notifications_log
  where id = p_log_id;

  if not found then
    raise exception 'WhatsApp log record % not found', p_log_id;
  end if;

  v_new_retry_count := v_log.retry_count + 1;

  if p_success then
    update public.whatsapp_notifications_log
    set
      status = 'sent',
      retry_count = v_new_retry_count,
      error_details = null,
      provider_message_id = coalesce(p_provider_message_id, provider_message_id),
      sent_at = coalesce(sent_at, now()),
      next_retry_at = null
    where id = p_log_id
    returning * into v_log;
  else
    -- Compute exponential backoff: base 1 min * 2^(retry_count)
    if v_new_retry_count >= v_log.max_retries then
      v_final_status := 'failed';
      v_next_retry := null;
    else
      v_final_status := 'queued';
      v_next_retry := now() + (interval '1 minute' * power(2, v_new_retry_count));
    end if;

    update public.whatsapp_notifications_log
    set
      status = v_final_status,
      retry_count = v_new_retry_count,
      error_details = p_error_details,
      next_retry_at = v_next_retry
    where id = p_log_id
    returning * into v_log;
  end if;

  return v_log;
end;
$$;

-- Procedure 4: Get Pending WhatsApp Retries
create or replace function public.get_pending_whatsapp_retries(
  p_max_batch_size integer default 20
)
returns setof public.whatsapp_notifications_log
language sql
security definer
set search_path = public
as $$
  select *
  from public.whatsapp_notifications_log
  where status in ('queued', 'failed')
    and retry_count < max_retries
    and (next_retry_at is null or next_retry_at <= now())
  order by created_at asc
  limit p_max_batch_size;
$$;

-- Procedure 5: Get Cohort WhatsApp Delivery Statistics
create or replace function public.get_cohort_whatsapp_stats(
  p_cohort_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_sent integer := 0;
  v_delivered integer := 0;
  v_read integer := 0;
  v_failed integer := 0;
  v_queued integer := 0;
  v_delivery_rate numeric := 0;
begin
  select
    count(*),
    count(*) filter (where status in ('sent', 'delivered', 'read')),
    count(*) filter (where status in ('delivered', 'read')),
    count(*) filter (where status = 'read'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status in ('queued', 'sending'))
  into
    v_total,
    v_sent,
    v_delivered,
    v_read,
    v_failed,
    v_queued
  from public.whatsapp_notifications_log
  where cohort_id = p_cohort_id;

  if v_total > 0 then
    v_delivery_rate := round((v_delivered::numeric / v_total::numeric) * 100, 1);
  end if;

  return jsonb_build_object(
    'cohort_id', p_cohort_id,
    'total_messages', v_total,
    'sent_count', v_sent,
    'delivered_count', v_delivered,
    'read_count', v_read,
    'failed_count', v_failed,
    'queued_count', v_queued,
    'delivery_rate_pct', v_delivery_rate
  );
end;
$$;

-- Grant execution permissions
grant execute on function public.dispatch_whatsapp_message to authenticated;
grant execute on function public.update_whatsapp_delivery_status to authenticated;
grant execute on function public.record_whatsapp_retry_attempt to authenticated;
grant execute on function public.get_pending_whatsapp_retries to authenticated;
grant execute on function public.get_cohort_whatsapp_stats to authenticated;
