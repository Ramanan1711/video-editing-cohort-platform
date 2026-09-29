-- ==============================================================================
-- Migration 25: Canonical Community Schema, Reactions, Reports & Realtime
-- File: supabase/migrations/20260928000020_canonical_community_schema_reactions_reports_and_realtime.sql
--
-- AUDIT RESOLUTION:
-- Promotes legacy ad-hoc community table declarations (previously found only in
-- supabase/admin_operations.sql, supabase/phase4_mentor_admin_operations.sql,
-- and supabase/student_flow_enhancements.sql) into the authoritative canonical
-- migration chain.
--
-- Scope:
-- 1. public.community_posts (discussions, attachments, moderation status, pins)
-- 2. public.community_comments (nested replies, author references, timestamps)
-- 3. public.community_reactions (per-user emoji toggles, unique constraints)
-- 4. public.community_reports (moderation queue, resolution status and audit notes)
-- 5. public.community_messages (real-time chat, channels, direct threads)
-- 6. Moderation & report RPCs (report_community_post, resolve_community_report, moderate_community_post)
-- 7. High-performance indexes, airtight RLS policies, and Supabase Realtime publication
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.community_posts
-- ------------------------------------------------------------------------------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text,
  body text not null,
  is_pinned boolean not null default false,
  moderation_status text not null default 'published',
  media_url text,
  media_type text,
  file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure all expected columns exist if table was partially created in earlier environments
alter table public.community_posts
  add column if not exists cohort_id uuid references public.cohorts(id) on delete cascade,
  add column if not exists lesson_id uuid references public.lessons(id) on delete set null,
  add column if not exists title text,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists moderation_status text not null default 'published',
  add column if not exists media_url text,
  add column if not exists media_type text,
  add column if not exists file_name text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Enforce check constraints
alter table public.community_posts
  drop constraint if exists community_posts_moderation_check;
alter table public.community_posts
  add constraint community_posts_moderation_check
  check (moderation_status in ('published', 'flagged', 'hidden'));

alter table public.community_posts
  drop constraint if exists community_posts_media_type_check;
alter table public.community_posts
  add constraint community_posts_media_type_check
  check (media_type is null or media_type in ('video', 'image', 'file'));

-- Indexes for performance
create index if not exists idx_community_posts_cohort on public.community_posts(cohort_id, created_at desc);
create index if not exists idx_community_posts_lesson on public.community_posts(lesson_id);
create index if not exists idx_community_posts_author on public.community_posts(author_id);
create index if not exists idx_community_posts_moderation on public.community_posts(moderation_status);
create index if not exists idx_community_posts_pinned on public.community_posts(is_pinned desc, created_at desc);

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.community_comments
-- ------------------------------------------------------------------------------
create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_comments
  add column if not exists post_id uuid not null references public.community_posts(id) on delete cascade,
  add column if not exists author_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists body text not null default '',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_community_comments_post on public.community_comments(post_id, created_at asc);
create index if not exists idx_community_comments_author on public.community_comments(author_id);

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.community_reactions
-- ------------------------------------------------------------------------------
create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now()
);

alter table public.community_reactions
  add column if not exists post_id uuid not null references public.community_posts(id) on delete cascade,
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists emoji text not null default '👍',
  add column if not exists created_at timestamptz not null default now();

-- Unique constraint ensuring one reaction per emoji per user per post
alter table public.community_reactions
  drop constraint if exists uq_community_post_user_emoji,
  drop constraint if exists unique_post_user_emoji;

alter table public.community_reactions
  add constraint uq_community_post_user_emoji
  unique (post_id, user_id, emoji);

create index if not exists idx_community_reactions_post on public.community_reactions(post_id);
create index if not exists idx_community_reactions_user on public.community_reactions(user_id);

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.community_reports
-- ------------------------------------------------------------------------------
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'pending',
  resolution_notes text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.community_reports
  add column if not exists post_id uuid not null references public.community_posts(id) on delete cascade,
  add column if not exists reporter_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists reason text not null default '',
  add column if not exists status text not null default 'pending',
  add column if not exists resolution_notes text,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.community_reports
  drop constraint if exists community_reports_status_check;
alter table public.community_reports
  add constraint community_reports_status_check
  check (status in ('pending', 'resolved', 'dismissed'));

create index if not exists idx_community_reports_post on public.community_reports(post_id);
create index if not exists idx_community_reports_status on public.community_reports(status);
create index if not exists idx_community_reports_reporter on public.community_reports(reporter_id);

-- ------------------------------------------------------------------------------
-- 5. TABLE: public.community_messages (Chat & Channels)
-- ------------------------------------------------------------------------------
create table if not exists public.community_messages (
  id text primary key default gen_random_uuid()::text,
  channel_id text not null,
  sender_id uuid references auth.users(id) on delete cascade,
  sender_name text not null default 'Community Member',
  sender_role text not null default 'student',
  sender_avatar text,
  content text not null,
  attachment_url text,
  reactions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.community_messages
  add column if not exists channel_id text not null default 'general',
  add column if not exists sender_id uuid references auth.users(id) on delete cascade,
  add column if not exists sender_name text not null default 'Community Member',
  add column if not exists sender_role text not null default 'student',
  add column if not exists sender_avatar text,
  add column if not exists content text not null default '',
  add column if not exists attachment_url text,
  add column if not exists reactions jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_community_messages_channel on public.community_messages(channel_id, created_at asc);
create index if not exists idx_community_messages_sender on public.community_messages(sender_id);

-- ------------------------------------------------------------------------------
-- 6. AUTOMATED TRIGGERS
-- ------------------------------------------------------------------------------

-- 6.1 Timestamp synchronization trigger function
create or replace function public.fn_sync_community_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_community_posts_updated_at on public.community_posts;
create trigger trg_sync_community_posts_updated_at
  before update on public.community_posts
  for each row
  execute function public.fn_sync_community_updated_at();

drop trigger if exists trg_sync_community_comments_updated_at on public.community_comments;
create trigger trg_sync_community_comments_updated_at
  before update on public.community_comments
  for each row
  execute function public.fn_sync_community_updated_at();

-- 6.2 Auto-flag posts when multiple pending reports are filed
create or replace function public.fn_auto_flag_reported_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report_count int;
begin
  select count(*) into v_report_count
  from public.community_reports
  where post_id = new.post_id and status = 'pending';

  -- If 3 or more pending reports accumulate, flag the post for urgent review
  if v_report_count >= 3 then
    update public.community_posts
    set moderation_status = 'flagged'
    where id = new.post_id and moderation_status = 'published';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_flag_reported_post on public.community_reports;
create trigger trg_auto_flag_reported_post
  after insert on public.community_reports
  for each row
  execute function public.fn_auto_flag_reported_post();

-- ------------------------------------------------------------------------------
-- 7. MODERATION & REPORTING RPCs
-- ------------------------------------------------------------------------------

-- 7.1 Submit a report on a community post
create or replace function public.report_community_post(
  p_post_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to report posts' using errcode = '42501';
  end if;

  if trim(p_reason) = '' then
    raise exception 'Report reason cannot be empty' using errcode = '22023';
  end if;

  if not exists (select 1 from public.community_posts where id = p_post_id) then
    raise exception 'Target community post does not exist' using errcode = 'P0002';
  end if;

  insert into public.community_reports (post_id, reporter_id, reason, status)
  values (p_post_id, auth.uid(), trim(p_reason), 'pending')
  returning id into v_report_id;

  return v_report_id;
end;
$$;

-- 7.2 Resolve or dismiss a moderation report
create or replace function public.resolve_community_report(
  p_report_id uuid,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_mentor_or_admin()) then
    raise exception 'Unauthorized: Only mentors or administrators can resolve moderation reports' using errcode = '42501';
  end if;

  if p_status not in ('resolved', 'dismissed') then
    raise exception 'Invalid report resolution status. Must be resolved or dismissed' using errcode = '22023';
  end if;

  update public.community_reports
  set
    status = p_status,
    resolution_notes = p_notes,
    resolved_by = auth.uid(),
    resolved_at = now()
  where id = p_report_id;

  if not found then
    raise exception 'Moderation report not found' using errcode = 'P0002';
  end if;
end;
$$;

-- 7.3 Moderate a community post status
create or replace function public.moderate_community_post(
  p_post_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_mentor_or_admin()) then
    raise exception 'Unauthorized: Only mentors or administrators can moderate community posts' using errcode = '42501';
  end if;

  if p_status not in ('published', 'flagged', 'hidden') then
    raise exception 'Invalid moderation status. Must be published, flagged, or hidden' using errcode = '22023';
  end if;

  update public.community_posts
  set moderation_status = p_status
  where id = p_post_id;

  if not found then
    raise exception 'Community post not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS on all community tables
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_messages enable row level security;

-- 8.1 public.community_posts policies
drop policy if exists "Active users can view posts" on public.community_posts;
drop policy if exists "Authenticated users can read posts" on public.community_posts;
drop policy if exists "Authenticated users can read published cohort posts" on public.community_posts;
create policy "Active users can view posts"
  on public.community_posts for select
  to authenticated
  using (
    -- Author and staff can view any post
    author_id = auth.uid()
    or public.is_mentor_or_admin()
    -- Others can view non-hidden posts scoped to their cohort or general posts
    or (
      moderation_status <> 'hidden'
      and (
        cohort_id is null
        or exists (
          select 1 from public.enrollments e
          where e.cohort_id = community_posts.cohort_id
            and e.user_id = auth.uid()
            and e.status in ('enrolled', 'active', 'completed')
        )
        or exists (
          select 1 from public.mentor_cohorts mc
          where mc.cohort_id = community_posts.cohort_id
            and mc.mentor_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Active users can insert community posts" on public.community_posts;
drop policy if exists "Active users can insert posts" on public.community_posts;
drop policy if exists "Users can create posts" on public.community_posts;
drop policy if exists "Enrolled students and staff can create posts" on public.community_posts;
create policy "Active users can insert community posts"
  on public.community_posts for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (public.is_active_user() or public.is_mentor_or_admin())
  );

drop policy if exists "Authors can update own community posts" on public.community_posts;
create policy "Authors can update own community posts"
  on public.community_posts for update
  to authenticated
  using (author_id = auth.uid() or public.is_mentor_or_admin())
  with check (author_id = auth.uid() or public.is_mentor_or_admin());

drop policy if exists "Authors and staff can delete community posts" on public.community_posts;
drop policy if exists "Admins can delete any community post" on public.community_posts;
create policy "Authors and staff can delete community posts"
  on public.community_posts for delete
  to authenticated
  using (author_id = auth.uid() or public.is_mentor_or_admin());

-- 8.2 public.community_comments policies
drop policy if exists "Active users can view comments" on public.community_comments;
drop policy if exists "Authenticated users can read comments" on public.community_comments;
create policy "Active users can view comments"
  on public.community_comments for select
  to authenticated
  using (
    exists (
      select 1 from public.community_posts p
      where p.id = community_comments.post_id
        and (
          p.author_id = auth.uid()
          or public.is_mentor_or_admin()
          or p.moderation_status <> 'hidden'
        )
    )
  );

drop policy if exists "Active users can insert comments" on public.community_comments;
drop policy if exists "Authenticated users can insert comments" on public.community_comments;
drop policy if exists "Users can create comments" on public.community_comments;
create policy "Active users can insert comments"
  on public.community_comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (public.is_active_user() or public.is_mentor_or_admin())
    and exists (
      select 1 from public.community_posts p
      where p.id = community_comments.post_id
        and (p.moderation_status <> 'hidden' or p.author_id = auth.uid() or public.is_mentor_or_admin())
    )
  );

drop policy if exists "Authors and staff can update comments" on public.community_comments;
create policy "Authors and staff can update comments"
  on public.community_comments for update
  to authenticated
  using (author_id = auth.uid() or public.is_mentor_or_admin())
  with check (author_id = auth.uid() or public.is_mentor_or_admin());

drop policy if exists "Authors and staff can delete comments" on public.community_comments;
drop policy if exists "Admins can delete any community comment" on public.community_comments;
create policy "Authors and staff can delete comments"
  on public.community_comments for delete
  to authenticated
  using (author_id = auth.uid() or public.is_mentor_or_admin());

-- 8.3 public.community_reactions policies
drop policy if exists "Reactions viewable by all authenticated users" on public.community_reactions;
create policy "Reactions viewable by all authenticated users"
  on public.community_reactions for select
  to authenticated
  using (true);

drop policy if exists "Users can insert own reactions" on public.community_reactions;
create policy "Users can insert own reactions"
  on public.community_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (public.is_active_user() or public.is_mentor_or_admin())
  );

drop policy if exists "Users and staff can delete reactions" on public.community_reactions;
drop policy if exists "Users can manage own reactions" on public.community_reactions;
create policy "Users and staff can delete reactions"
  on public.community_reactions for delete
  to authenticated
  using (user_id = auth.uid() or public.is_mentor_or_admin());

-- 8.4 public.community_reports policies
drop policy if exists "Staff and reporters can view reports" on public.community_reports;
drop policy if exists "Staff can view and manage reports" on public.community_reports;
create policy "Staff and reporters can view reports"
  on public.community_reports for select
  to authenticated
  using (reporter_id = auth.uid() or public.is_mentor_or_admin());

drop policy if exists "Users can submit reports" on public.community_reports;
create policy "Users can submit reports"
  on public.community_reports for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and (public.is_active_user() or public.is_mentor_or_admin())
  );

drop policy if exists "Staff can update reports" on public.community_reports;
create policy "Staff can update reports"
  on public.community_reports for update
  to authenticated
  using (public.is_mentor_or_admin())
  with check (public.is_mentor_or_admin());

drop policy if exists "Admins can delete reports" on public.community_reports;
create policy "Admins can delete reports"
  on public.community_reports for delete
  to authenticated
  using (public.is_admin());

-- 8.5 public.community_messages policies
drop policy if exists "Active users can view chat messages" on public.community_messages;
create policy "Active users can view chat messages"
  on public.community_messages for select
  to authenticated
  using (public.is_active_user() or public.is_mentor_or_admin());

drop policy if exists "Active users can insert chat messages" on public.community_messages;
create policy "Active users can insert chat messages"
  on public.community_messages for insert
  to authenticated
  with check (
    (sender_id is null or sender_id = auth.uid())
    and (public.is_active_user() or public.is_mentor_or_admin())
  );

drop policy if exists "Senders can update own chat messages" on public.community_messages;
create policy "Senders can update own chat messages"
  on public.community_messages for update
  to authenticated
  using (sender_id = auth.uid() or public.is_admin())
  with check (sender_id = auth.uid() or public.is_admin());

drop policy if exists "Senders and staff can delete chat messages" on public.community_messages;
create policy "Senders and staff can delete chat messages"
  on public.community_messages for delete
  to authenticated
  using (sender_id = auth.uid() or public.is_mentor_or_admin());

-- ------------------------------------------------------------------------------
-- 9. SUPABASE REALTIME PUBLICATION REGISTRATION
-- ------------------------------------------------------------------------------
alter table if exists public.community_posts replica identity full;
alter table if exists public.community_comments replica identity full;
alter table if exists public.community_reactions replica identity full;
alter table if exists public.community_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_posts'
  ) then
    execute 'alter publication supabase_realtime add table public.community_posts';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_comments'
  ) then
    execute 'alter publication supabase_realtime add table public.community_comments';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_reactions'
  ) then
    execute 'alter publication supabase_realtime add table public.community_reactions';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.community_messages';
  end if;
end $$;
