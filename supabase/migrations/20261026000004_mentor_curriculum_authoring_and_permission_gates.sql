-- ==============================================================================
-- Migration: 20261026000004_mentor_curriculum_authoring_and_permission_gates.sql
-- Description:
-- Grants mentors full course authoring provisions:
--   1. Author cohorts, modules, lessons, lesson resources, challenges, daily tasks.
--   2. Enforces permission gate: mentors can upload/edit only for cohorts in
--      ('draft', 'review', 'approved', 'rejected').
--   3. Published cohorts are locked against direct mentor modification;
--      modifications require permission from Parent Super Admin or Child Super Admin.
-- ==============================================================================

-- 1. Enhance public.is_mentor_for_cohort to include created_by check
create or replace function public.is_mentor_for_cohort(p_cohort_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('mentor', 'admin')
      and coalesce(p.status, 'active') = 'active'
      and (
        p.role = 'admin'
        or exists (
          select 1 from public.mentor_cohorts mc
          where mc.mentor_id = auth.uid() and mc.cohort_id = p_cohort_id
        )
        or exists (
          select 1 from public.cohorts c
          where c.id = p_cohort_id and c.created_by = auth.uid()
        )
      )
  );
$$;

-- 2. Helper to verify if mentor has permission to edit/upload to cohort
-- Mentors need permission from admin for upload/edit:
-- Permitted only while cohort is in draft, review, approved, or rejected.
-- If cohort is published, direct mentor edits are locked (require admin permission/unlock).
create or replace function public.is_cohort_editable_by_mentor(p_cohort_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select (
    public.is_admin()
    or (
      public.is_mentor_for_cohort(p_cohort_id)
      and exists (
        select 1 from public.cohorts c
        where c.id = p_cohort_id
          and c.status in ('draft', 'review', 'reviewing', 'approved', 'rejected')
      )
    )
  );
$$;

-- 3. RLS for public.modules: allow mentors to manage modules for editable cohorts
drop policy if exists "Mentors can manage modules in editable cohorts" on public.modules;
create policy "Mentors can manage modules in editable cohorts"
  on public.modules for all
  to authenticated
  using (
    public.is_admin()
    or (cohort_id is not null and public.is_cohort_editable_by_mentor(cohort_id))
  )
  with check (
    public.is_admin()
    or (cohort_id is not null and public.is_cohort_editable_by_mentor(cohort_id))
  );

-- 4. RLS for public.lessons: allow mentors to manage lessons in editable cohorts
drop policy if exists "Mentors can manage lessons in editable cohorts" on public.lessons;
create policy "Mentors can manage lessons in editable cohorts"
  on public.lessons for all
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.modules m
      where m.id = lessons.module_id
        and m.cohort_id is not null
        and public.is_cohort_editable_by_mentor(m.cohort_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.modules m
      where m.id = lessons.module_id
        and m.cohort_id is not null
        and public.is_cohort_editable_by_mentor(m.cohort_id)
    )
  );

-- 5. RLS for public.lesson_resources: allow mentors to manage resources in editable cohorts
drop policy if exists "Mentors can manage resources in editable cohorts" on public.lesson_resources;
create policy "Mentors can manage resources in editable cohorts"
  on public.lesson_resources for all
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      where l.id = lesson_resources.lesson_id
        and m.cohort_id is not null
        and public.is_cohort_editable_by_mentor(m.cohort_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      where l.id = lesson_resources.lesson_id
        and m.cohort_id is not null
        and public.is_cohort_editable_by_mentor(m.cohort_id)
    )
  );

-- 6. RLS for public.daily_sprint_tasks / daily_challenges: allow mentors to manage challenges in editable cohorts
drop policy if exists "Mentors can manage daily challenges in editable cohorts" on public.daily_challenges;
create policy "Mentors can manage daily challenges in editable cohorts"
  on public.daily_challenges for all
  to authenticated
  using (
    public.is_admin()
    or (cohort_id is not null and public.is_cohort_editable_by_mentor(cohort_id))
  )
  with check (
    public.is_admin()
    or (cohort_id is not null and public.is_cohort_editable_by_mentor(cohort_id))
  );

-- 7. RLS for course_challenges: allow mentors to manage quests in editable cohorts
drop policy if exists "Mentors can manage course challenges in editable cohorts" on public.course_challenges;
create policy "Mentors can manage course challenges in editable cohorts"
  on public.course_challenges for all
  to authenticated
  using (
    public.is_admin()
    or (cohort_id is not null and public.is_cohort_editable_by_mentor(cohort_id))
  )
  with check (
    public.is_admin()
    or (cohort_id is not null and public.is_cohort_editable_by_mentor(cohort_id))
  );
