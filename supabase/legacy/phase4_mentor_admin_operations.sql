-- supabase/phase4_mentor_admin_operations.sql
-- Migration script for Phase 4: Mentor and Admin Operations
--
-- Enables:
-- 1. User status tracking (active / suspended / inactive) on public.profiles
-- 2. Admin management of cohort enrollments (create, update status, remove)
-- 3. Community moderation policies for admins (delete / manage posts and comments)
-- 4. Admin announcement and live session update / delete capabilities

-- ==============================================================================
-- 1. User Profiles Status & Admin Update Policies
-- ==============================================================================
alter table public.profiles
  add column if not exists status text not null default 'active';

-- Ensure status constraint
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('active', 'suspended', 'inactive'));

-- Helper function: check if caller is an admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper function: check if caller is mentor or admin
create or replace function public.is_mentor_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('mentor', 'admin')
  );
$$;

-- Ensure Admins have full access to update all profile fields (role, status)
drop policy if exists "Admins can update user profiles" on public.profiles;
create policy "Admins can update user profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ==============================================================================
-- 2. Cohort Enrollments: Admin Management Policies
-- ==============================================================================
alter table public.enrollments enable row level security;

drop policy if exists "Admins have full management on enrollments" on public.enrollments;
create policy "Admins have full management on enrollments"
  on public.enrollments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ==============================================================================
-- 3. Community Moderation Policies for Admins
-- ==============================================================================
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;

-- Admins can delete any community post for moderation
drop policy if exists "Admins can delete any community post" on public.community_posts;
create policy "Admins can delete any community post"
  on public.community_posts for delete
  to authenticated
  using (public.is_admin());

-- Admins can delete any community comment for moderation
drop policy if exists "Admins can delete any community comment" on public.community_comments;
create policy "Admins can delete any community comment"
  on public.community_comments for delete
  to authenticated
  using (public.is_admin());

-- ==============================================================================
-- 4. Announcements & Live Sessions Admin Management
-- ==============================================================================
alter table public.announcements enable row level security;
alter table public.live_sessions enable row level security;

drop policy if exists "Admins can manage announcements" on public.announcements;
create policy "Admins can manage announcements"
  on public.announcements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can manage sessions" on public.live_sessions;
create policy "Admins can manage sessions"
  on public.live_sessions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ==============================================================================
-- 5. Submissions: Ensure Mentors & Admins can Read and Review All Submissions
-- ==============================================================================
alter table public.submissions enable row level security;

drop policy if exists "Mentors and Admins can view all submissions" on public.submissions;
create policy "Mentors and Admins can view all submissions"
  on public.submissions for select
  to authenticated
  using (
    student_id = auth.uid()
    or public.is_mentor_or_admin()
  );

drop policy if exists "Mentors and Admins can update submissions" on public.submissions;
create policy "Mentors and Admins can update submissions"
  on public.submissions for update
  to authenticated
  using (public.is_mentor_or_admin())
  with check (public.is_mentor_or_admin());

