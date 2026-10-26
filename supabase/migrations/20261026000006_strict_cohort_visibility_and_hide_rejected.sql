-- ==============================================================================
-- Migration: 20261026000006_strict_cohort_visibility_and_hide_rejected.sql
-- Description:
--   Strictly prevents unapproved, rejected, or draft cohorts from appearing
--   to students or anonymous visitors on student dashboards or course catalogs.
--   1. Public read policy on public.cohorts strictly requires status in ('published', 'active', 'upcoming')
--      AND (visibility = 'public' or visibility is null).
--   2. Mentors can read their own created/assigned cohorts regardless of status.
--   3. Admins can read all cohorts regardless of status.
-- ==============================================================================

alter table public.cohorts enable row level security;

drop policy if exists "Anyone can read public cohorts" on public.cohorts;
drop policy if exists "Anyone can read public published cohorts" on public.cohorts;
drop policy if exists "Public can view published cohorts" on public.cohorts;
drop policy if exists "Public can view cohorts" on public.cohorts;
drop policy if exists "Authenticated users can read cohorts" on public.cohorts;
drop policy if exists "Mentors can read own created or assigned cohorts" on public.cohorts;

-- Public & student read policy: strictly published / active cohorts
create policy "Anyone can read public published cohorts"
  on public.cohorts for select
  using (
    (
      status in ('published', 'active', 'upcoming')
      and (visibility = 'public' or visibility is null)
    )
    or (
      auth.role() = 'authenticated' and public.is_admin()
    )
    or (
      auth.role() = 'authenticated' and (
        created_by = auth.uid()
        or id in (select cohort_id from public.mentor_cohorts where mentor_id = auth.uid())
      )
    )
  );

grant select on public.cohorts to anon, authenticated;
