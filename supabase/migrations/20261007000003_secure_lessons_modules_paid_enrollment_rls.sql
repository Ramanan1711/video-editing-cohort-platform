-- Migration: 20261007000003_secure_lessons_modules_paid_enrollment_rls.sql
-- Description: Enforces strict paid-enrollment RLS on modules and lessons.
-- Eliminates course access vulnerability where authenticated students could view
-- modules and lessons (including video_urls) of unpaid public/published cohorts.

-- 1. Modules Select Policy: Restrict cohort modules to enrolled students, assigned mentors, or admins
drop policy if exists "Modules select policy" on public.modules;
create policy "Modules select policy"
  on public.modules for select
  to authenticated
  using (
    public.is_admin()
    or (
      cohort_id is not null
      and (
        public.is_mentor_for_cohort(cohort_id)
        or exists (
          select 1 from public.enrollments e
          where e.cohort_id = modules.cohort_id
            and e.user_id = auth.uid()
            and e.status in ('enrolled', 'active', 'completed')
        )
      )
    )
    or (
      cohort_id is null
      and exists (
        select 1 from public.courses co
        where co.id = modules.course_id
          and co.status in ('published', 'active')
      )
    )
  );

-- 2. Lessons Select Policy: Restrict cohort lessons to enrolled students, assigned mentors, or admins
drop policy if exists "Lessons select policy" on public.lessons;
create policy "Lessons select policy"
  on public.lessons for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.modules m
      where m.id = lessons.module_id
      and (
        (m.cohort_id is not null and public.is_mentor_for_cohort(m.cohort_id))
        or (
          (lessons.status in ('published', 'review') or lessons.status is null)
          and (
            (
              m.cohort_id is not null
              and exists (
                select 1 from public.enrollments e
                where e.cohort_id = m.cohort_id
                  and e.user_id = auth.uid()
                  and e.status in ('enrolled', 'active', 'completed')
              )
            )
            or (
              m.cohort_id is null
            )
          )
        )
      )
    )
  );

