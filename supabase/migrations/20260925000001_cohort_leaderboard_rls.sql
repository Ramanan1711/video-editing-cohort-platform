-- ==============================================================================
-- supabase/migrations/20260925000001_cohort_leaderboard_rls.sql
-- Enables Cohort-Based Community Leaderboard & Peer Visibility
-- ==============================================================================

-- 1. Allow enrolled students to view peer enrollments within their same cohort
drop policy if exists "Users can view enrollments" on public.enrollments;
drop policy if exists "Enrolled students can view cohort peers and staff can read all" on public.enrollments;

create policy "Enrolled students can view cohort peers and staff can read all"
  on public.enrollments for select
  to authenticated
  using (
    public.is_active_user()
    and (
      user_id = auth.uid()
      or public.is_admin()
      or public.is_mentor_for_cohort(cohort_id)
      or exists (
        select 1 from public.enrollments my_enrollment
        where my_enrollment.user_id = auth.uid()
        and my_enrollment.cohort_id = enrollments.cohort_id
      )
    )
  );

-- 2. Allow authenticated community members to view gamification XP on leaderboards
drop policy if exists "Users can view own gamification record" on public.student_gamification;
drop policy if exists "Authenticated users can view gamification for leaderboard" on public.student_gamification;

create policy "Authenticated users can view gamification for leaderboard"
  on public.student_gamification for select
  to authenticated
  using (true);

-- 3. Security Definer RPC for Cohort-Scoped Leaderboard
-- Safely aggregates enrolled students, computes PRO points, and ranks them by course title
create or replace function public.get_enrolled_cohort_leaderboard(p_cohort_id uuid default null)
returns table (
  user_id uuid,
  cohort_id uuid,
  cohort_title text,
  full_name text,
  email text,
  xp_points integer,
  editor_level integer,
  completed_lessons bigint,
  submissions_count bigint,
  reviewed_submissions_count bigint
) language plpgsql security definer set search_path = public as $$
begin
  return query
  with target_enrollments as (
    select
      e.user_id,
      e.cohort_id,
      coalesce(c.title, 'Course') as cohort_title
    from public.enrollments e
    left join public.cohorts c on c.id = e.cohort_id
    where (p_cohort_id is null or e.cohort_id = p_cohort_id)
  ),
  lesson_counts as (
    select
      lp.user_id,
      count(*)::bigint as completed_count
    from public.lesson_progress lp
    where lp.completed = true
    group by lp.user_id
  ),
  submission_counts as (
    select
      s.student_id,
      count(*)::bigint as total_count,
      count(*) filter (where s.status = 'reviewed')::bigint as reviewed_count
    from public.submissions s
    group by s.student_id
  )
  select
    te.user_id,
    te.cohort_id,
    te.cohort_title,
    coalesce(p.full_name, split_part(p.email, '@', 1), 'Enrolled Student') as full_name,
    p.email,
    greatest(
      coalesce(sg.xp_points, 0),
      (coalesce(lc.completed_count, 0) * 50 + coalesce(sc.total_count, 0) * 150 + coalesce(sc.reviewed_count, 0) * 300)::integer
    ) as xp_points,
    coalesce(sg.editor_level, 1) as editor_level,
    coalesce(lc.completed_count, 0) as completed_lessons,
    coalesce(sc.total_count, 0) as submissions_count,
    coalesce(sc.reviewed_count, 0) as reviewed_submissions_count
  from target_enrollments te
  left join public.profiles p on p.id = te.user_id
  left join public.student_gamification sg on sg.user_id = te.user_id
  left join lesson_counts lc on lc.user_id = te.user_id
  left join submission_counts sc on sc.student_id = te.user_id
  order by xp_points desc, full_name asc;
end;
$$;
