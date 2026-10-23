-- ==============================================================================
-- Migration: 20261023000001_allow_public_read_cohorts_and_fix_rls.sql
-- Description: Enable public read access for cohorts and courses for anon & authenticated users.
-- Resolves: Incognito / unauthenticated visitors seeing zero available cohorts due to missing
--           anon SELECT RLS policy on public.cohorts and public.courses.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Harmonize cohorts table RLS policies
-- ------------------------------------------------------------------------------
alter table public.cohorts enable row level security;

drop policy if exists "Anyone can read public cohorts" on public.cohorts;
drop policy if exists "Public can view published cohorts" on public.cohorts;
drop policy if exists "Public can view cohorts" on public.cohorts;
drop policy if exists "Authenticated users can read cohorts" on public.cohorts;
drop policy if exists "Admins have full management on cohorts" on public.cohorts;
drop policy if exists "Admins can manage cohorts" on public.cohorts;

-- Allow anonymous visitors and authenticated users to view published, active, upcoming, or public cohorts
create policy "Anyone can read public cohorts"
  on public.cohorts for select
  using (
    visibility = 'public'
    or status in ('published', 'active', 'upcoming')
    or (auth.role() = 'authenticated' and public.is_admin())
  );

-- Admins retain full management rights (insert, update, delete)
create policy "Admins have full management on cohorts"
  on public.cohorts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.cohorts to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Harmonize courses table RLS policies
-- ------------------------------------------------------------------------------
alter table public.courses enable row level security;

drop policy if exists "Courses select policy" on public.courses;
drop policy if exists "Anyone can read published courses" on public.courses;

-- Allow anonymous visitors and authenticated users to view published or active courses
create policy "Anyone can read published courses"
  on public.courses for select
  using (
    status in ('published', 'active')
    or (auth.role() = 'authenticated' and public.is_admin())
  );

grant select on public.courses to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Resilient Security Definer Public RPC
-- ------------------------------------------------------------------------------
create or replace function public.get_public_cohorts()
returns setof public.cohorts
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.cohorts
  where (
    visibility = 'public'
    or coalesce(status, 'published') in ('published', 'active', 'upcoming')
  )
  order by title;
$$;

grant execute on function public.get_public_cohorts() to anon, authenticated;

