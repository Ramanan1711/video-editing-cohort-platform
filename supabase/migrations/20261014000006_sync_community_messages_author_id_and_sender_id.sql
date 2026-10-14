-- ==============================================================================
-- Migration: 20261014000006_sync_community_messages_author_id_and_sender_id.sql
-- Description: Ensures dual-column compatibility for public.community_messages
--              Supporting both author_id / sender_id and body / content,
--              dropping accidental rigid NOT NULL constraints, and auto-syncing with trigger.
-- ==============================================================================

-- 1. Ensure author_id and sender_id columns exist
alter table if exists public.community_messages
  add column if not exists author_id uuid references auth.users(id) on delete cascade;

alter table if exists public.community_messages
  add column if not exists sender_id uuid references auth.users(id) on delete cascade;

-- 2. Ensure body and content columns exist
alter table if exists public.community_messages
  add column if not exists body text;

alter table if exists public.community_messages
  add column if not exists content text;

-- 3. If author_id or body has a rigid NOT NULL constraint, drop it so inserting with either convention succeeds
alter table if exists public.community_messages
  alter column author_id drop not null;

alter table if exists public.community_messages
  alter column body drop not null;

alter table if exists public.community_messages
  alter column content drop not null;

-- 4. Sync existing records
update public.community_messages
set author_id = sender_id
where author_id is null and sender_id is not null;

update public.community_messages
set sender_id = author_id
where sender_id is null and author_id is not null;

update public.community_messages
set body = content
where body is null and content is not null;

update public.community_messages
set content = body
where content is null and body is not null;

-- 5. Trigger to automatically keep fields in sync on INSERT or UPDATE
create or replace function public.fn_sync_community_messages_fields()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.author_id is null and new.sender_id is not null then
    new.author_id = new.sender_id;
  end if;
  if new.sender_id is null and new.author_id is not null then
    new.sender_id = new.author_id;
  end if;
  if new.body is null and new.content is not null then
    new.body = new.content;
  end if;
  if new.content is null and new.body is not null then
    new.content = new.body;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_community_messages_fields on public.community_messages;
create trigger trg_sync_community_messages_fields
  before insert or update on public.community_messages
  for each row
  execute function public.fn_sync_community_messages_fields();

-- 6. Ensure indexes exist for identifier and channel columns
create index if not exists idx_community_messages_author on public.community_messages(author_id);
create index if not exists idx_community_messages_sender on public.community_messages(sender_id);
