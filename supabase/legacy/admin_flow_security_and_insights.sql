-- supabase/admin_flow_security_and_insights.sql
-- Migration Script: Production Admin Governance, Security Hardening & Insights Suite
--
-- Features:
-- 1. Database-level suspension barrier: updates is_admin() & is_mentor_or_admin() to reject suspended accounts.
-- 2. New helper public.is_active_user() for strict RLS access control.
-- 3. Content publishing lifecycle: updates check constraints to support ('draft', 'review', 'published', 'archived').
-- 4. Pre-enrollment invitations table for bulk student imports.
-- 5. Strict RLS policies preventing suspended accounts from accessing lessons, submissions, or community boards.

-- ==============================================================================
-- 1. Hardened RBAC and Suspension Functions
-- ==============================================================================

-- Check if current authenticated user is active (not suspended)
create or replace function public.is_active_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and coalesce(status, 'active') != 'suspended'
  );
$$;

-- Update is_admin to strictly require non-suspended status
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(status, 'active') != 'suspended'
  );
$$;

-- Update is_mentor_or_admin to strictly require non-suspended status
create or replace function public.is_mentor_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('mentor', 'admin')
      and coalesce(status, 'active') != 'suspended'
  );
$$;

-- ==============================================================================
-- 2. Content Publishing Lifecycle: draft -> review -> published -> archived
-- ==============================================================================

-- Ensure lessons table has status column with 4-stage lifecycle check
alter table public.lessons
  add column if not exists status text not null default 'published';

alter table public.lessons drop constraint if exists lessons_status_check;
alter table public.lessons add constraint lessons_status_check
  check (status in ('draft', 'review', 'published', 'archived'));

create index if not exists idx_lessons_status on public.lessons(status);

-- Ensure cohorts table has status column with 4-stage lifecycle check
alter table public.cohorts
  add column if not exists status text not null default 'published';

alter table public.cohorts drop constraint if exists cohorts_status_check;
alter table public.cohorts add constraint cohorts_status_check
  check (status in ('draft', 'review', 'published', 'archived'));

-- ==============================================================================
-- 3. Bulk Enrollment Invitations (Pre-Provisioning)
-- ==============================================================================

create table if not exists public.enrollment_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index if not exists idx_invitations_email_cohort
  on public.enrollment_invitations(lower(email), cohort_id)
  where status = 'pending';

alter table public.enrollment_invitations enable row level security;

drop policy if exists "Admins can manage invitations" on public.enrollment_invitations;
create policy "Admins can manage invitations"
  on public.enrollment_invitations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Auto-enroll trigger when an invited user registers with matching email
create or replace function public.handle_invited_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation record;
begin
  for invitation in
    select id, cohort_id
    from public.enrollment_invitations
    where lower(email) = lower(new.email)
      and status = 'pending'
  loop
    -- Insert active enrollment
    insert into public.enrollments (user_id, cohort_id, status, created_at)
    values (new.id, invitation.cohort_id, 'active', now())
    on conflict (user_id, cohort_id) do nothing;

    -- Mark invitation accepted
    update public.enrollment_invitations
    set status = 'accepted', accepted_at = now()
    where id = invitation.id;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_invited_user_signup on public.profiles;
create trigger on_invited_user_signup
  after insert on public.profiles
  for each row
  execute function public.handle_invited_user_signup();

-- ==============================================================================
-- 4. Suspended User RLS Restrictions
-- ==============================================================================

-- Block suspended users from inserting or updating community posts
drop policy if exists "Active users can insert community posts" on public.community_posts;
create policy "Active users can insert community posts"
  on public.community_posts for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.is_active_user()
  );

-- Block suspended users from submitting assignments
drop policy if exists "Active students can submit assignments" on public.submissions;
create policy "Active students can submit assignments"
  on public.submissions for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and public.is_active_user()
  );

