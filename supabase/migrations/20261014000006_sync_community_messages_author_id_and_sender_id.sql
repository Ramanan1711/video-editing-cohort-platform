-- ==============================================================================
-- Migration: 20261014000006_sync_community_messages_author_id_and_sender_id.sql
-- Description: Ensures dual-column compatibility for public.community_messages
--              Supporting both author_id and sender_id, dropping accidental NOT NULL
--              constraints on author_id, and auto-syncing with trigger.
-- ==============================================================================

-- 1. Ensure author_id column exists
alter table if exists public.community_messages
  add column if not exists author_id uuid references auth.users(id) on delete cascade;

-- 2. Ensure sender_id column exists
alter table if exists public.community_messages
  add column if not exists sender_id uuid references auth.users(id) on delete cascade;

-- 3. If author_id has a rigid NOT NULL constraint, drop it so inserting with sender_id or author_id succeeds
alter table if exists public.community_messages
  alter column author_id drop not null;

-- 4. Sync existing records
update public.community_messages
set author_id = sender_id
where author_id is null and sender_id is not null;

update public.community_messages
set sender_id = author_id
where sender_id is null and author_id is not null;

-- 5. Trigger to automatically keep author_id and sender_id in sync on INSERT or UPDATE
create or replace function public.fn_sync_community_messages_author()
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
  return new;
end;
$$;

drop trigger if exists trg_sync_community_messages_author on public.community_messages;
create trigger trg_sync_community_messages_author
  before insert or update on public.community_messages
  for each row
  execute function public.fn_sync_community_messages_author();

-- 6. Ensure indexes exist for both identifier columns
create index if not exists idx_community_messages_author on public.community_messages(author_id);
create index if not exists idx_community_messages_sender on public.community_messages(sender_id);

