-- ==============================================================================
-- Migration: 20261026000005_fix_mentor_cohorts_rls_and_lessons_check_constraint.sql
-- Description:
--   1. Fixes mentor_cohorts RLS policies so mentors can link themselves to cohorts.
--   2. Adds an auto-link trigger on cohorts table for creator mentors.
--   3. Updates lessons_status_check to accept 'draft', 'review', 'reviewing', 'approved', 'rejected', 'published', 'archived'.
--   4. Updates modules_status_check and cohorts_status_check for full lifecycle compatibility.
-- ==============================================================================

-- 1. Ensure mentor_cohorts RLS allows creator mentors to insert/link
alter table public.mentor_cohorts enable row level security;

drop policy if exists "Admins can manage mentor_cohorts" on public.mentor_cohorts;
drop policy if exists "Mentors can view own cohort assignments" on public.mentor_cohorts;
drop policy if exists "Authenticated users can view mentor assignments" on public.mentor_cohorts;
drop policy if exists "Mentors can manage own mentor_cohorts" on public.mentor_cohorts;
drop policy if exists "Mentors can insert own cohort links" on public.mentor_cohorts;
drop policy if exists "Mentors and admins can link mentor cohorts" on public.mentor_cohorts;
drop policy if exists "Mentors and admins can manage mentor cohorts" on public.mentor_cohorts;

-- Read policy: Anyone authenticated can view mentor-cohort links
create policy "Authenticated users can view mentor assignments"
  on public.mentor_cohorts for select
  to authenticated
  using (true);

-- Insert policy: Admins or the mentor themselves
create policy "Mentors and admins can link mentor cohorts"
  on public.mentor_cohorts for insert
  to authenticated
  with check (
    public.is_admin()
    or mentor_id = auth.uid()
  );

-- Update/Delete policy: Admins or the assigned mentor
create policy "Mentors and admins can manage mentor cohorts"
  on public.mentor_cohorts for all
  to authenticated
  using (
    public.is_admin()
    or mentor_id = auth.uid()
  )
  with check (
    public.is_admin()
    or mentor_id = auth.uid()
  );

-- 2. Auto-link trigger on cohorts table when created by a mentor
create or replace function public.auto_link_creator_mentor_cohort()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.created_by is not null then
    -- If the creator has mentor role, ensure they are linked in mentor_cohorts
    if exists (select 1 from public.profiles where id = NEW.created_by and role = 'mentor') then
      insert into public.mentor_cohorts (mentor_id, cohort_id, created_at, assigned_at)
      values (NEW.created_by, NEW.id, now(), now())
      on conflict do nothing;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_auto_link_creator_mentor_cohort on public.cohorts;
create trigger trg_auto_link_creator_mentor_cohort
  after insert on public.cohorts
  for each row
  execute function public.auto_link_creator_mentor_cohort();

-- 3. Update lessons_status_check to include 'review', 'reviewing', 'approved', 'rejected'
alter table public.lessons drop constraint if exists lessons_status_check;
alter table public.lessons add constraint lessons_status_check
  check (status in ('draft', 'review', 'reviewing', 'approved', 'rejected', 'published', 'archived'));

-- 4. Update modules_status_check for full lifecycle consistency
alter table public.modules drop constraint if exists modules_status_check;
alter table public.modules add constraint modules_status_check
  check (status in ('draft', 'review', 'reviewing', 'approved', 'rejected', 'published', 'archived'));

-- 5. Update cohorts_status_check for full lifecycle consistency
alter table public.cohorts drop constraint if exists cohorts_status_check;
alter table public.cohorts add constraint cohorts_status_check
  check (status in ('draft', 'review', 'reviewing', 'approved', 'rejected', 'published', 'archived', 'upcoming', 'active', 'completed'));
