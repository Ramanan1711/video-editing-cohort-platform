-- ==============================================================================
-- Migration: 20260928000030_canonical_notifications_dispatch_metadata_and_dual_columns.sql
-- Description: Notifications Schema Dual-Column Resilience & 6-Argument Dispatcher Overload
-- Resolves:
--   1. Fixes ERROR 42883: function public.dispatch_notification(uuid, unknown, text, unknown, unknown, jsonb) does not exist
--      by defining the 6-parameter dispatch_notification overload with metadata support.
--   2. Fixes ERROR PGRST204: Could not find the 'message' column of 'notifications' in the schema cache
--      by adding dual columns (message <-> body, type <-> category, metadata) with automated synchronization triggers.
-- ==============================================================================

-- 1. Dual column compatibility on public.notifications
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists body text;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists category text default 'system';
alter table public.notifications add column if not exists metadata jsonb default '{}'::jsonb;

-- Backfill missing columns for historical rows
update public.notifications
set message = body
where message is null and body is not null;

update public.notifications
set body = message
where body is null and message is not null;

update public.notifications
set type = category
where type is null and category is not null;

update public.notifications
set category = type
where (category is null or category = 'system') and type is not null and type <> 'system';

-- 2. Bidirectional sync trigger function between (body <-> message) and (category <-> type)
create or replace function public.sync_notification_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sync body <-> message
  if new.body is null and new.message is not null then
    new.body := new.message;
  elsif new.message is null and new.body is not null then
    new.message := new.body;
  elsif new.message is distinct from old.message and new.body is not distinct from old.body then
    new.body := new.message;
  elsif new.body is distinct from old.body and new.message is not distinct from old.message then
    new.message := new.body;
  end if;

  -- Sync category <-> type
  if (new.category is null or new.category = 'system') and new.type is not null then
    new.category := new.type;
  elsif (new.type is null or new.type = 'system') and new.category is not null then
    new.type := new.category;
  elsif new.type is distinct from old.type and new.category is not distinct from old.category then
    new.category := new.type;
  elsif new.category is distinct from old.category and new.type is not distinct from old.type then
    new.type := new.category;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_notification_columns on public.notifications;
create trigger trg_sync_notification_columns
  before insert or update on public.notifications
  for each row
  execute function public.sync_notification_columns();

-- 3. Authoritative 6-Argument Dispatcher RPC with Metadata Payload
create or replace function public.dispatch_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_category text,
  p_action_url text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notif_id uuid;
  v_clean_title text;
  v_clean_body text;
  v_clean_category text;
begin
  if p_user_id is null or length(trim(coalesce(p_title, ''))) = 0 then
    return null;
  end if;

  v_clean_title := trim(p_title);
  v_clean_body := trim(coalesce(p_body, ''));
  v_clean_category := coalesce(nullif(trim(p_category), ''), 'system');

  insert into public.notifications (
    user_id,
    title,
    body,
    message,
    category,
    type,
    action_url,
    metadata,
    created_at
  )
  values (
    p_user_id,
    v_clean_title,
    v_clean_body,
    v_clean_body,
    v_clean_category,
    v_clean_category,
    p_action_url,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  returning id into v_notif_id;

  return v_notif_id;
end;
$$;

-- 4. Authoritative 5-Argument Dispatcher RPC (Forwards to 6-arg version with empty metadata)
create or replace function public.dispatch_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_category text default 'system',
  p_action_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.dispatch_notification(
    p_user_id,
    p_title,
    p_body,
    p_category,
    p_action_url,
    '{}'::jsonb
  );
end;
$$;

-- Grant permissions on both signatures
grant execute on function public.dispatch_notification(uuid, text, text, text, text, jsonb) to authenticated, anon;
grant execute on function public.dispatch_notification(uuid, text, text, text, text) to authenticated, anon;
