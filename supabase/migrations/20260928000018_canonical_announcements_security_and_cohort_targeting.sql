-- ==============================================================================
-- Migration: 20260928000018_canonical_announcements_security_and_cohort_targeting.sql
-- Description:
-- 1. Hardens public.publish_announcement against privilege escalation:
--    - Replaces insecure 'role = admin or admin_role in (...)' with authoritative
--      public.has_admin_permission('broadcast_announcements').
--    - Strictly authorizes active super_admin, operations_admin, and moderator.
--    - Denies access to students, mentors, content_admin, and unauthenticated users.
-- 2. Implements authoritative cohort-targeted dispatches:
--    - Guarantees cohort_id column on public.announcements referencing public.cohorts.
--    - Updates publish_announcement RPC with p_cohort_id default null.
--    - When p_cohort_id is provided: validates cohort existence and dispatches
--      in-app notifications specifically to students enrolled in that cohort.
--    - When p_cohort_id is null: dispatches broadcast notifications platform-wide.
--    - Backwards-compatible overload for 3-argument invocations.
-- 3. Canonical RLS policies for public.announcements:
--    - SELECT: author, admins, or if published: platform-wide or user's enrolled cohort / mentor cohort.
--    - INSERT, UPDATE, DELETE: strictly protected by has_admin_permission('broadcast_announcements').
-- ==============================================================================

-- 1. Ensure Announcements Table Structure & Indexes
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  title text not null,
  body text not null,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Ensure cohort_id column exists
alter table public.announcements add column if not exists cohort_id uuid references public.cohorts(id) on delete cascade;

-- Performance and lookup indexes
create index if not exists idx_announcements_author_id on public.announcements(author_id);
create index if not exists idx_announcements_cohort_id on public.announcements(cohort_id);
create index if not exists idx_announcements_published on public.announcements(published);
create index if not exists idx_announcements_created_at on public.announcements(created_at desc);

-- 2. Authoritative Server-Side RPC: publish_announcement
-- Drop existing publish_announcement functions first to resolve PostgreSQL 42P13 parameter default conflicts
drop function if exists public.publish_announcement(text, text, boolean);
drop function if exists public.publish_announcement(text, text, uuid, boolean);

create or replace function public.publish_announcement(
  p_title text,
  p_body text,
  p_cohort_id uuid,
  p_published boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_is_authorized boolean;
  v_inserted record;
  v_cohort_name text := null;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  -- Authoritatively evaluate granular administrative permission
  -- Requires role = 'admin' and active status; permits super_admin, operations_admin, moderator.
  -- Blocks non-admins and content_admin without exception.
  v_is_authorized := public.has_admin_permission('broadcast_announcements');

  if not v_is_authorized then
    raise exception 'Unauthorized: Only authorized administrative staff can broadcast announcements.'
      using errcode = '42501';
  end if;

  -- Validate title & body constraints
  if length(trim(coalesce(p_title, ''))) < 3 then
    raise exception 'Announcement title must be at least 3 characters long.'
      using errcode = '22000';
  end if;

  if length(trim(coalesce(p_body, ''))) < 5 then
    raise exception 'Announcement body must be at least 5 characters long.'
      using errcode = '22000';
  end if;

  -- Validate cohort existence if cohort targeting is specified
  if p_cohort_id is not null then
    select name into v_cohort_name
    from public.cohorts
    where id = p_cohort_id;

    if not found then
      raise exception 'Target cohort % does not exist.', p_cohort_id
        using errcode = '23503';
    end if;
  end if;

  -- Insert announcement record
  insert into public.announcements (
    author_id,
    cohort_id,
    title,
    body,
    published,
    created_at
  )
  values (
    v_caller_id,
    p_cohort_id,
    trim(p_title),
    trim(p_body),
    p_published,
    now()
  )
  returning id, author_id, cohort_id, title, body, published, created_at
  into v_inserted;

  -- Dispatch in-app notifications if announcement is published
  if p_published then
    if p_cohort_id is not null then
      -- Dispatch specifically to students actively enrolled in this cohort
      insert into public.notifications (
        user_id,
        title,
        body,
        category,
        action_url,
        created_at
      )
      select distinct
        e.user_id,
        trim(p_title),
        left(trim(p_body), 160),
        'announcement',
        '/announcements',
        now()
      from public.enrollments e
      join public.profiles p on p.id = e.user_id
      where e.cohort_id = p_cohort_id
        and e.status in ('active', 'completed')
        and coalesce(p.status, 'active') = 'active';
    else
      -- Dispatch platform broadcast to all active students and mentors
      insert into public.notifications (
        user_id,
        title,
        body,
        category,
        action_url,
        created_at
      )
      select
        p.id,
        trim(p_title),
        left(trim(p_body), 160),
        'announcement',
        '/announcements',
        now()
      from public.profiles p
      where coalesce(p.status, 'active') = 'active'
        and p.role in ('student', 'mentor');
    end if;
  end if;

  -- Emit canonical audit log
  perform public.log_audit_event(
    'announcement.created',
    'announcement',
    v_inserted.id::text,
    jsonb_build_object(
      'title', v_inserted.title,
      'cohort_id', v_inserted.cohort_id,
      'cohort_name', v_cohort_name,
      'published', v_inserted.published
    )
  );

  return to_jsonb(v_inserted);
end;
$$;

grant execute on function public.publish_announcement(text, text, uuid, boolean) to authenticated;

-- Backwards-compatible overload for legacy invocations (p_title, p_body, p_published default true)
create or replace function public.publish_announcement(
  p_title text,
  p_body text,
  p_published boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.publish_announcement(p_title, p_body, null::uuid, p_published);
end;
$$;

grant execute on function public.publish_announcement(text, text, boolean) to authenticated;

-- 3. Canonical Row Level Security (RLS) on public.announcements
alter table public.announcements enable row level security;

-- Drop obsolete or loosely scoped policies
drop policy if exists "Authenticated users can read announcements" on public.announcements;
drop policy if exists "Admins can manage announcements" on public.announcements;
drop policy if exists "announcements_select_policy" on public.announcements;
drop policy if exists "announcements_insert_policy" on public.announcements;
drop policy if exists "announcements_update_policy" on public.announcements;
drop policy if exists "announcements_delete_policy" on public.announcements;

-- A. SELECT: Author, admins, or published announcements scoped to platform/cohort
create policy "announcements_select_policy"
  on public.announcements for select
  to authenticated
  using (
    -- Author can always view own announcements (drafts and published)
    author_id = auth.uid()
    -- Admins can view all announcements
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.status, 'active') = 'active'
    )
    -- Published announcements: platform-wide or scoped to enrolled cohort / assigned mentor cohort
    or (
      published = true
      and (
        cohort_id is null
        or exists (
          select 1 from public.enrollments e
          where e.cohort_id = announcements.cohort_id
            and e.user_id = auth.uid()
            and e.status in ('active', 'completed')
        )
        or exists (
          select 1 from public.mentor_cohorts mc
          where mc.cohort_id = announcements.cohort_id
            and mc.mentor_id = auth.uid()
        )
      )
    )
  );

-- B. INSERT: Restricted to authorized administrative staff with broadcast permission
create policy "announcements_insert_policy"
  on public.announcements for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.has_admin_permission('broadcast_announcements')
  );

-- C. UPDATE: Restricted to authorized administrative staff with broadcast permission
create policy "announcements_update_policy"
  on public.announcements for update
  to authenticated
  using (
    public.has_admin_permission('broadcast_announcements')
  )
  with check (
    public.has_admin_permission('broadcast_announcements')
  );

-- D. DELETE: Restricted to authorized administrative staff with broadcast permission
create policy "announcements_delete_policy"
  on public.announcements for delete
  to authenticated
  using (
    public.has_admin_permission('broadcast_announcements')
  );

