-- ==============================================================================
-- supabase/migrations/20260921000002_rbac_and_cohort_scoping.sql
-- Role-Based Access Control, Mentor-to-Cohort Scoping, and Authorization Helpers
-- ==============================================================================

-- 1. Mentor Cohort Assignments Table
create table if not exists public.mentor_cohorts (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mentor_id, cohort_id)
);

create index if not exists idx_mentor_cohorts_mentor on public.mentor_cohorts(mentor_id);
create index if not exists idx_mentor_cohorts_cohort on public.mentor_cohorts(cohort_id);

alter table public.mentor_cohorts enable row level security;

-- 2. Authorization Helper Functions (Security Definer, fixed search_path)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.is_mentor_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('mentor', 'admin')
      and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.is_mentor_for_cohort(p_cohort_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.mentor_cohorts mc
    join public.profiles p on p.id = mc.mentor_id
    where mc.mentor_id = auth.uid()
      and mc.cohort_id = p_cohort_id
      and coalesce(p.status, 'active') = 'active'
  );
$$;

create or replace function public.is_mentor_for_student(p_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.enrollments e
    join public.mentor_cohorts mc on mc.cohort_id = e.cohort_id
    join public.profiles p on p.id = mc.mentor_id
    where e.user_id = p_student_id
      and mc.mentor_id = auth.uid()
      and coalesce(p.status, 'active') = 'active'
  );
$$;

-- 3. RLS on mentor_cohorts
drop policy if exists "Admins can manage mentor_cohorts" on public.mentor_cohorts;
create policy "Admins can manage mentor_cohorts"
  on public.mentor_cohorts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Mentors can view own cohort assignments" on public.mentor_cohorts;
create policy "Mentors can view own cohort assignments"
  on public.mentor_cohorts for select
  to authenticated
  using (mentor_id = auth.uid() or public.is_admin());

