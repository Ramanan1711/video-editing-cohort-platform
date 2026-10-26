-- ==============================================================================
-- Migration: 20261026000007_unlock_mentor_curriculum_authoring.sql
-- Description:
--   Removes the lock constraint on published cohorts for mentors.
--   Mentors can author, upload, and modify curriculum (modules, lessons, challenges,
--   daily tasks) at any time without locking barriers.
--   Review and approval remains with Parent Super Admin or Child Super Admin.
-- ==============================================================================

-- 1. Redefine is_cohort_editable_by_mentor to remove published status restriction
create or replace function public.is_cohort_editable_by_mentor(p_cohort_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select (
    public.is_admin()
    or public.is_mentor_for_cohort(p_cohort_id)
  );
$$;

-- 2. Ensure mentors can update their own cohorts regardless of status
drop policy if exists "Mentors can update own draft or approved cohorts" on public.cohorts;
drop policy if exists "Mentors can update own cohorts" on public.cohorts;

create policy "Mentors can update own cohorts"
  on public.cohorts for update
  to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.mentor_cohorts mc
      where mc.mentor_id = auth.uid() and mc.cohort_id = id
    )
  )
  with check (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.mentor_cohorts mc
      where mc.mentor_id = auth.uid() and mc.cohort_id = id
    )
  );
