-- ==============================================================================
-- Migration: 20260928000003_admin_reporting_and_schema_resilience.sql
-- Description:
-- 1. Hardens schema resilience: dual column compatibility for mentor_cohorts
--    (created_at, assigned_at) and submissions (version, version_number, is_late).
-- 2. Implements server-side executive report aggregation RPC (get_admin_report_summary)
--    so admin dashboards do not rely on fragile client-side raw table joins.
-- 3. Grants execute permissions to authorized admins.
-- ==============================================================================

-- 1. Dual column compatibility for mentor_cohorts
create table if not exists public.mentor_cohorts (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  created_at timestamptz not null default now(),
  assigned_at timestamptz default now(),
  unique (mentor_id, cohort_id)
);

alter table public.mentor_cohorts add column if not exists assigned_at timestamptz default now();
alter table public.mentor_cohorts add column if not exists created_at timestamptz default now();

-- 2. Dual column compatibility for submissions
alter table public.submissions add column if not exists version integer default 1;
alter table public.submissions add column if not exists version_number integer default 1;
alter table public.submissions add column if not exists is_late boolean default false;

-- 3. Server-side Executive Report Aggregation RPC
create or replace function public.get_admin_report_summary(
  p_timeframe text default '30d'
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_cutoff timestamptz;
  v_total_users int := 0;
  v_student_count int := 0;
  v_mentor_count int := 0;
  v_admin_count int := 0;
  v_total_cohorts int := 0;
  v_total_enrollments int := 0;
  v_active_enrollments int := 0;
  v_completed_enrollments int := 0;
  v_dropped_enrollments int := 0;
  v_pending_submissions int := 0;
  v_reviewed_submissions int := 0;
  v_avg_turnaround_hours numeric := null;
  v_churn_rate_pct int := 0;
  v_completion_rate_pct int := 0;
  v_result jsonb;
begin
  -- 1. Enforce caller must have view_insights or is_admin
  if not (public.has_admin_permission('view_insights') or public.is_admin()) then
    raise exception 'Unauthorized: Insufficient permissions to view executive reports.'
      using errcode = '42501';
  end if;

  -- 2. Resolve timeframe cutoff
  if p_timeframe = '7d' then
    v_cutoff := now() - interval '7 days';
  elsif p_timeframe = '90d' then
    v_cutoff := now() - interval '90 days';
  elsif p_timeframe = 'all' then
    v_cutoff := '1970-01-01'::timestamptz;
  else
    -- Default 30 days
    v_cutoff := now() - interval '30 days';
  end if;

  -- 3. Users breakdown
  select
    count(*),
    count(*) filter (where role = 'student'),
    count(*) filter (where role = 'mentor'),
    count(*) filter (where role = 'admin')
  into
    v_total_users,
    v_student_count,
    v_mentor_count,
    v_admin_count
  from public.profiles
  where coalesce(status, 'active') = 'active';

  -- 4. Cohorts count
  select count(*) into v_total_cohorts from public.cohorts;

  -- 5. Enrollments breakdown
  select
    count(*),
    count(*) filter (where status in ('active', 'enrolled')),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'dropped')
  into
    v_total_enrollments,
    v_active_enrollments,
    v_completed_enrollments,
    v_dropped_enrollments
  from public.enrollments
  where created_at >= v_cutoff or v_cutoff = '1970-01-01'::timestamptz;

  if v_total_enrollments > 0 then
    v_completion_rate_pct := round((v_completed_enrollments::numeric / v_total_enrollments) * 100);
    v_churn_rate_pct := round((v_dropped_enrollments::numeric / v_total_enrollments) * 100);
  end if;

  -- 6. Submissions breakdown
  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'reviewed')
  into
    v_pending_submissions,
    v_reviewed_submissions
  from public.submissions
  where created_at >= v_cutoff or v_cutoff = '1970-01-01'::timestamptz;

  -- 7. Average turnaround hours (feedback timestamp - submission timestamp)
  select round(avg(extract(epoch from (f.created_at - s.created_at)) / 3600)::numeric, 1)
  into v_avg_turnaround_hours
  from public.feedback f
  join public.submissions s on s.id = f.submission_id
  where f.created_at >= v_cutoff
    and f.created_at >= s.created_at;

  -- 8. Assemble structured JSON response
  v_result := jsonb_build_object(
    'timeframe', p_timeframe,
    'generated_at', now(),
    'users', jsonb_build_object(
      'total', v_total_users,
      'students', v_student_count,
      'mentors', v_mentor_count,
      'admins', v_admin_count
    ),
    'cohorts', jsonb_build_object(
      'total', v_total_cohorts
    ),
    'enrollments', jsonb_build_object(
      'total', v_total_enrollments,
      'active', v_active_enrollments,
      'completed', v_completed_enrollments,
      'dropped', v_dropped_enrollments,
      'completion_rate_pct', v_completion_rate_pct,
      'churn_rate_pct', v_churn_rate_pct
    ),
    'submissions', jsonb_build_object(
      'pending', v_pending_submissions,
      'reviewed', v_reviewed_submissions,
      'avg_turnaround_hours', v_avg_turnaround_hours
    )
  );

  return v_result;
end;
$$;

grant execute on function public.get_admin_report_summary(text) to authenticated, anon;
