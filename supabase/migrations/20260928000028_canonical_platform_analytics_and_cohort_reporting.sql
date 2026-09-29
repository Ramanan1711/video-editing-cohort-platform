-- ==============================================================================
-- Migration: 20260928000028_canonical_platform_analytics_and_cohort_reporting.sql
-- Description: Canonical Platform Analytics & Trustworthy Cohort Reporting Baseline
-- Resolves:
--   1. Replaces client-side mocked and defaulted analytics with authoritative,
--      server-side Postgres aggregations.
--   2. Provides public.get_authoritative_platform_analytics(p_cohort_id, p_timeframe)
--      returning precise active users, completion rates, submission timeliness,
--      review SLAs, and cohort retention.
--   3. Provides public.get_cohort_reporting_baseline(p_cohort_id) computing the
--      authoritative, trustworthy baseline metrics for any cohort:
--      - Roster fill and attrition (retention % & churn %)
--      - Curriculum completion % and watch % across enrolled students
--      - Expected vs actual assignment submission rate % (replacing hardcoded 85%)
--      - Submission timeliness on-time %
--      - Mentor review turnaround hours & SLA compliance (<24h) %
--      - Live workshop attendance rate %
--      - Live count of at-risk students
--   4. Provides public.get_cohort_at_risk_students(p_cohort_id) with real,
--      grounded risk attribution (stalled inactivity, low watch %, multiple resubmits).
--   5. Applies strict RBAC governance (view_insights, is_admin, or assigned mentor).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Authoritative Platform Analytics Aggregator RPC
-- ------------------------------------------------------------------------------
create or replace function public.get_authoritative_platform_analytics(
  p_cohort_id uuid default null,
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
  v_students int := 0;
  v_mentors int := 0;
  v_admins int := 0;
  v_suspended int := 0;

  v_total_enrollments int := 0;
  v_completed_lessons int := 0;
  v_completion_rate_pct int := 0;
  v_avg_watch_pct int := 0;

  v_total_submissions int := 0;
  v_pending_subs int := 0;
  v_reviewed_subs int := 0;
  v_resubmit_subs int := 0;
  v_on_time_subs int := 0;
  v_late_subs int := 0;
  v_on_time_rate_pct int := 0;

  v_total_graded int := 0;
  v_avg_turnaround_hours numeric := 0;
  v_sla_compliance_rate_pct int := 0;

  v_total_cohorts int := 0;
  v_active_cohorts int := 0;
  v_completed_enrollments int := 0;
  v_dropped_enrollments int := 0;
  v_waitlisted_students int := 0;
  v_retention_rate_pct int := 0;

  v_cohort_lesson_count int := 0;
  v_active_students_in_cohort int := 0;
  v_turnaround_sum numeric := 0;
  v_sla_compliant_count int := 0;
begin
  -- RBAC check: must be admin or have view_insights permission
  if not (public.has_admin_permission('view_insights') or public.is_admin()) then
    raise exception 'Unauthorized: Insufficient permissions to view platform analytics.'
      using errcode = '42501';
  end if;

  -- Resolve cutoff timestamp
  if p_timeframe = '7d' then
    v_cutoff := now() - interval '7 days';
  elsif p_timeframe = '90d' then
    v_cutoff := now() - interval '90 days';
  elsif p_timeframe = 'all' then
    v_cutoff := '1970-01-01'::timestamptz;
  else
    v_cutoff := now() - interval '30 days';
  end if;

  -- 1. Active Users Breakdown
  if p_cohort_id is null then
    select
      count(*) filter (where coalesce(prof.status, 'active') <> 'suspended'),
      count(*) filter (where prof.role = 'student' and coalesce(prof.status, 'active') <> 'suspended'),
      count(*) filter (where prof.role = 'mentor' and coalesce(prof.status, 'active') <> 'suspended'),
      count(*) filter (where prof.role = 'admin' and coalesce(prof.status, 'active') <> 'suspended'),
      count(*) filter (where coalesce(prof.status, 'active') = 'suspended')
    into
      v_total_users,
      v_students,
      v_mentors,
      v_admins,
      v_suspended
    from public.profiles prof;
  else
    -- Scoped to cohort
    select
      count(distinct prof.id) filter (where coalesce(prof.status, 'active') <> 'suspended'),
      count(distinct prof.id) filter (where prof.role = 'student' and coalesce(prof.status, 'active') <> 'suspended'),
      count(distinct prof.id) filter (where prof.role = 'mentor' and coalesce(prof.status, 'active') <> 'suspended'),
      count(distinct prof.id) filter (where prof.role = 'admin' and coalesce(prof.status, 'active') <> 'suspended'),
      count(distinct prof.id) filter (where coalesce(prof.status, 'active') = 'suspended')
    into
      v_total_users,
      v_students,
      v_mentors,
      v_admins,
      v_suspended
    from public.profiles prof
    where prof.id in (
      select e.user_id from public.enrollments e where e.cohort_id = p_cohort_id
      union
      select mc.mentor_id from public.mentor_cohorts mc where mc.cohort_id = p_cohort_id
    );
  end if;

  -- 2. Cohort Conversion & Retention
  if p_cohort_id is null then
    select
      count(*),
      count(*) filter (where c.status in ('published', 'active'))
    into
      v_total_cohorts,
      v_active_cohorts
    from public.cohorts c;

    select
      count(*),
      count(*) filter (where e.status = 'completed'),
      count(*) filter (where e.status = 'dropped'),
      count(*) filter (where e.status in ('waitlist', 'waitlisted'))
    into
      v_total_enrollments,
      v_completed_enrollments,
      v_dropped_enrollments,
      v_waitlisted_students
    from public.enrollments e;
  else
    v_total_cohorts := 1;
    select count(*) into v_active_cohorts
    from public.cohorts c
    where c.id = p_cohort_id and c.status in ('published', 'active');

    select
      count(*),
      count(*) filter (where e.status = 'completed'),
      count(*) filter (where e.status = 'dropped'),
      count(*) filter (where e.status in ('waitlist', 'waitlisted'))
    into
      v_total_enrollments,
      v_completed_enrollments,
      v_dropped_enrollments,
      v_waitlisted_students
    from public.enrollments e
    where e.cohort_id = p_cohort_id;
  end if;

  if v_total_enrollments > 0 then
    v_retention_rate_pct := round(((v_total_enrollments - v_dropped_enrollments)::numeric / v_total_enrollments) * 100);
  else
    v_retention_rate_pct := 0;
  end if;

  -- 3. Lesson Completion Rates
  if p_cohort_id is null then
    select
      count(*) filter (where lp.completed = true or coalesce(lp.watch_percentage, 0) >= 80),
      coalesce(round(avg(coalesce(lp.watch_percentage, 0))), 0)
    into
      v_completed_lessons,
      v_avg_watch_pct
    from public.lesson_progress lp;

    -- Completion rate across all progress rows
    select
      case
        when count(*) > 0 then
          round((count(*) filter (where lp.completed = true or coalesce(lp.watch_percentage, 0) >= 80)::numeric / count(*)) * 100)
        else 0
      end
    into v_completion_rate_pct
    from public.lesson_progress lp;
  else
    -- Total lessons in this cohort
    select count(l.id)
    into v_cohort_lesson_count
    from public.lessons l
    join public.modules m on m.id = l.module_id
    where m.cohort_id = p_cohort_id;

    select count(e.id)
    into v_active_students_in_cohort
    from public.enrollments e
    where e.cohort_id = p_cohort_id and e.status in ('active', 'enrolled', 'completed');

    select
      count(*) filter (where lp.completed = true or coalesce(lp.watch_percentage, 0) >= 80),
      coalesce(round(avg(coalesce(lp.watch_percentage, 0))), 0)
    into
      v_completed_lessons,
      v_avg_watch_pct
    from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    join public.modules m on m.id = l.module_id
    join public.enrollments e on e.user_id = lp.user_id and e.cohort_id = p_cohort_id
    where m.cohort_id = p_cohort_id;

    if (v_cohort_lesson_count * v_active_students_in_cohort) > 0 then
      v_completion_rate_pct := round((v_completed_lessons::numeric / (v_cohort_lesson_count * v_active_students_in_cohort)) * 100);
    else
      v_completion_rate_pct := 0;
    end if;
  end if;

  -- 4. Assignment Submissions & Timeliness
  select
    count(s.id),
    count(s.id) filter (where s.status = 'pending'),
    count(s.id) filter (where s.status = 'reviewed'),
    count(s.id) filter (where s.status in ('resubmit_requested', 'needs_work', 'resubmit')),
    count(s.id) filter (where coalesce(s.is_late, false) = true),
    count(s.id) filter (where coalesce(s.is_late, false) = false)
  into
    v_total_submissions,
    v_pending_subs,
    v_reviewed_subs,
    v_resubmit_subs,
    v_late_subs,
    v_on_time_subs
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where (p_cohort_id is null or a.cohort_id = p_cohort_id)
    and (s.created_at >= v_cutoff or v_cutoff = '1970-01-01'::timestamptz);

  if v_total_submissions > 0 then
    v_on_time_rate_pct := round((v_on_time_subs::numeric / v_total_submissions) * 100);
  else
    v_on_time_rate_pct := 0;
  end if;

  -- 5. Review Turnaround & SLA Compliance
  v_total_graded := v_reviewed_subs + v_resubmit_subs;

  select
    coalesce(round(avg(extract(epoch from (f.created_at - s.created_at)) / 3600)::numeric, 1), 0),
    count(*) filter (where extract(epoch from (f.created_at - s.created_at)) / 3600 <= 24)
  into
    v_avg_turnaround_hours,
    v_sla_compliant_count
  from public.feedback f
  join public.submissions s on s.id = f.submission_id
  join public.assignments a on a.id = s.assignment_id
  where (p_cohort_id is null or a.cohort_id = p_cohort_id)
    and (f.created_at >= v_cutoff or v_cutoff = '1970-01-01'::timestamptz)
    and f.created_at >= s.created_at;

  if v_total_graded > 0 then
    v_sla_compliance_rate_pct := round((v_sla_compliant_count::numeric / v_total_graded) * 100);
  else
    v_sla_compliance_rate_pct := 0;
  end if;

  return jsonb_build_object(
    'activeUsers', jsonb_build_object(
      'total', v_total_users,
      'students', v_students,
      'mentors', v_mentors,
      'admins', v_admins,
      'suspended', v_suspended
    ),
    'lessonCompletion', jsonb_build_object(
      'totalEnrollments', v_total_enrollments,
      'completedLessons', v_completed_lessons,
      'completionRatePct', v_completion_rate_pct,
      'avgWatchPercentage', v_avg_watch_pct
    ),
    'assignmentSubmissions', jsonb_build_object(
      'totalSubmissions', v_total_submissions,
      'pendingCount', v_pending_subs,
      'reviewedCount', v_reviewed_subs,
      'resubmitCount', v_resubmit_subs,
      'onTimeSubmissions', v_on_time_subs,
      'lateSubmissions', v_late_subs,
      'onTimeRatePct', v_on_time_rate_pct
    ),
    'reviewTurnaround', jsonb_build_object(
      'totalGraded', v_total_graded,
      'pendingQueue', v_pending_subs,
      'avgTurnaroundHours', v_avg_turnaround_hours,
      'slaComplianceRatePct', v_sla_compliance_rate_pct
    ),
    'cohortConversion', jsonb_build_object(
      'totalCohorts', v_total_cohorts,
      'activeCohorts', v_active_cohorts,
      'totalEnrolledStudents', v_total_enrollments,
      'completedEnrollments', v_completed_enrollments,
      'droppedEnrollments', v_dropped_enrollments,
      'waitlistedStudents', v_waitlisted_students,
      'retentionRatePct', v_retention_rate_pct
    ),
    'computedAt', now()
  );
end;
$$;

grant execute on function public.get_authoritative_platform_analytics(uuid, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 2. Authoritative Cohort Reporting Baseline RPC
-- ------------------------------------------------------------------------------
create or replace function public.get_cohort_reporting_baseline(
  p_cohort_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_cohort record;
  v_total_enrolled int := 0;
  v_active_count int := 0;
  v_completed_count int := 0;
  v_dropped_count int := 0;
  v_waitlisted_count int := 0;
  v_retention_rate_pct numeric := 0;
  v_churn_rate_pct numeric := 0;

  v_total_modules int := 0;
  v_total_lessons int := 0;
  v_completed_lessons int := 0;
  v_completion_rate_pct numeric := 0;
  v_avg_watch_pct numeric := 0;

  v_total_assignments int := 0;
  v_expected_submissions int := 0;
  v_actual_submissions int := 0;
  v_submission_rate_pct numeric := 0;
  v_pending_submissions int := 0;
  v_reviewed_submissions int := 0;
  v_resubmit_submissions int := 0;
  v_on_time_submissions int := 0;
  v_late_submissions int := 0;
  v_on_time_rate_pct numeric := 0;

  v_total_graded int := 0;
  v_avg_turnaround_hours numeric := 0;
  v_sla_compliance_rate_pct numeric := 0;

  v_live_sessions_count int := 0;
  v_attendance_rate_pct numeric := 0;
  v_at_risk_count int := 0;
begin
  -- RBAC check: must be admin or assigned mentor
  if not (
    public.has_admin_permission('view_insights') or
    public.is_admin() or
    exists (select 1 from public.mentor_cohorts mc where mc.mentor_id = auth.uid() and mc.cohort_id = p_cohort_id)
  ) then
    raise exception 'Unauthorized: Insufficient permissions to view cohort baseline.'
      using errcode = '42501';
  end if;

  -- 1. Fetch cohort record
  select id, coalesce(title, name, 'Untitled Cohort') as cohort_name, status, capacity, start_date, end_date
  into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if v_cohort.id is null then
    raise exception 'Cohort % not found.', p_cohort_id
      using errcode = 'P0002';
  end if;

  -- 2. Enrollment breakdown
  select
    count(*),
    count(*) filter (where e.status in ('active', 'enrolled')),
    count(*) filter (where e.status = 'completed'),
    count(*) filter (where e.status = 'dropped'),
    count(*) filter (where e.status in ('waitlist', 'waitlisted'))
  into
    v_total_enrolled,
    v_active_count,
    v_completed_count,
    v_dropped_count,
    v_waitlisted_count
  from public.enrollments e
  where e.cohort_id = p_cohort_id;

  if v_total_enrolled > 0 then
    v_retention_rate_pct := round(((v_total_enrolled - v_dropped_count)::numeric / v_total_enrolled) * 100, 1);
    v_churn_rate_pct := round((v_dropped_count::numeric / v_total_enrolled) * 100, 1);
  end if;

  -- 3. Modules and Lessons in this Cohort
  select count(distinct m.id), count(distinct l.id)
  into v_total_modules, v_total_lessons
  from public.modules m
  left join public.lessons l on l.module_id = m.id
  where m.cohort_id = p_cohort_id;

  -- Completed lessons and average watch percentage
  select
    count(distinct lp.id) filter (where lp.completed = true or coalesce(lp.watch_percentage, 0) >= 80),
    coalesce(round(avg(coalesce(lp.watch_percentage, 0)), 1), 0)
  into
    v_completed_lessons,
    v_avg_watch_pct
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  join public.modules m on m.id = l.module_id
  join public.enrollments e on e.user_id = lp.user_id and e.cohort_id = p_cohort_id
  where m.cohort_id = p_cohort_id;

  if (v_total_lessons * v_total_enrolled) > 0 then
    v_completion_rate_pct := round((v_completed_lessons::numeric / (v_total_lessons * v_total_enrolled)) * 100, 1);
  else
    v_completion_rate_pct := 0;
  end if;

  -- 4. Assignments & Submission Velocity
  select count(*)
  into v_total_assignments
  from public.assignments a
  where a.cohort_id = p_cohort_id;

  v_expected_submissions := v_total_assignments * v_total_enrolled;

  select
    count(s.id),
    count(s.id) filter (where s.status = 'pending'),
    count(s.id) filter (where s.status = 'reviewed'),
    count(s.id) filter (where s.status in ('resubmit_requested', 'needs_work', 'resubmit')),
    count(s.id) filter (where coalesce(s.is_late, false) = false),
    count(s.id) filter (where coalesce(s.is_late, false) = true)
  into
    v_actual_submissions,
    v_pending_submissions,
    v_reviewed_submissions,
    v_resubmit_submissions,
    v_on_time_submissions,
    v_late_submissions
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where a.cohort_id = p_cohort_id;

  if v_expected_submissions > 0 then
    v_submission_rate_pct := round((v_actual_submissions::numeric / v_expected_submissions) * 100, 1);
  else
    v_submission_rate_pct := 0;
  end if;

  if v_actual_submissions > 0 then
    v_on_time_rate_pct := round((v_on_time_submissions::numeric / v_actual_submissions) * 100, 1);
  else
    v_on_time_rate_pct := 0;
  end if;

  -- 5. Mentor Reviews & SLAs
  v_total_graded := v_reviewed_submissions + v_resubmit_submissions;

  select
    coalesce(round(avg(extract(epoch from (f.created_at - s.created_at)) / 3600)::numeric, 1), 0),
    case
      when count(*) > 0 then
        round((count(*) filter (where extract(epoch from (f.created_at - s.created_at)) / 3600 <= 24)::numeric / count(*)) * 100, 1)
      else 0
    end
  into
    v_avg_turnaround_hours,
    v_sla_compliance_rate_pct
  from public.feedback f
  join public.submissions s on s.id = f.submission_id
  join public.assignments a on a.id = s.assignment_id
  where a.cohort_id = p_cohort_id
    and f.created_at >= s.created_at;

  -- 6. Live Sessions & Attendance Rate
  select count(distinct ls.id)
  into v_live_sessions_count
  from public.live_sessions ls
  where ls.cohort_id = p_cohort_id;

  if (v_live_sessions_count * v_total_enrolled) > 0 then
    select
      coalesce(
        round((count(sa.id) filter (where sa.status in ('present', 'late'))::numeric / (v_live_sessions_count * v_total_enrolled)) * 100, 1),
        0
      )
    into v_attendance_rate_pct
    from public.session_attendance sa
    join public.live_sessions ls on ls.id = sa.session_id
    where ls.cohort_id = p_cohort_id;
  else
    v_attendance_rate_pct := 0;
  end if;

  -- 7. Count of At-Risk Students
  select count(*)
  into v_at_risk_count
  from public.get_cohort_at_risk_students(p_cohort_id);

  return jsonb_build_object(
    'cohortId', v_cohort.id,
    'cohortName', v_cohort.cohort_name,
    'status', v_cohort.status,
    'capacity', coalesce(v_cohort.capacity, 30),
    'startDate', v_cohort.start_date,
    'endDate', v_cohort.end_date,
    'enrollment', jsonb_build_object(
      'totalEnrolled', v_total_enrolled,
      'activeCount', v_active_count,
      'completedCount', v_completed_count,
      'droppedCount', v_dropped_count,
      'waitlistedCount', v_waitlisted_count,
      'retentionRatePct', v_retention_rate_pct,
      'churnRatePct', v_churn_rate_pct,
      'fillRatePct', case when coalesce(v_cohort.capacity, 30) > 0 then round((v_total_enrolled::numeric / coalesce(v_cohort.capacity, 30)) * 100, 1) else 0 end
    ),
    'curriculum', jsonb_build_object(
      'totalModules', v_total_modules,
      'totalLessons', v_total_lessons,
      'completedLessons', v_completed_lessons,
      'completionRatePct', v_completion_rate_pct,
      'avgWatchPercentage', v_avg_watch_pct
    ),
    'submissions', jsonb_build_object(
      'totalAssignments', v_total_assignments,
      'expectedSubmissions', v_expected_submissions,
      'actualSubmissions', v_actual_submissions,
      'submissionRatePct', v_submission_rate_pct,
      'pendingSubmissions', v_pending_submissions,
      'reviewedSubmissions', v_reviewed_submissions,
      'resubmitSubmissions', v_resubmit_submissions,
      'onTimeSubmissions', v_on_time_submissions,
      'lateSubmissions', v_late_submissions,
      'onTimeRatePct', v_on_time_rate_pct
    ),
    'reviewSla', jsonb_build_object(
      'totalGraded', v_total_graded,
      'pendingQueue', v_pending_submissions,
      'avgTurnaroundHours', v_avg_turnaround_hours,
      'slaComplianceRatePct', v_sla_compliance_rate_pct
    ),
    'attendance', jsonb_build_object(
      'liveSessionsCount', v_live_sessions_count,
      'attendanceRatePct', v_attendance_rate_pct
    ),
    'atRiskStudentsCount', v_at_risk_count,
    'computedAt', now()
  );
end;
$$;

grant execute on function public.get_cohort_reporting_baseline(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. Authoritative At-Risk Students Detection RPC
-- ------------------------------------------------------------------------------
create or replace function public.get_cohort_at_risk_students(
  p_cohort_id uuid default null
)
returns table (
  student_id uuid,
  student_name text,
  student_email text,
  cohort_id uuid,
  cohort_name text,
  days_inactive integer,
  resubmissions_count integer,
  watch_percentage numeric,
  risk_reason text,
  enrolled_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  -- RBAC check: must be admin or assigned mentor
  if not (
    public.has_admin_permission('view_insights') or
    public.is_admin() or
    (p_cohort_id is not null and exists (
      select 1 from public.mentor_cohorts mc where mc.mentor_id = auth.uid() and mc.cohort_id = p_cohort_id
    ))
  ) then
    raise exception 'Unauthorized: Insufficient permissions to view at-risk learners.'
      using errcode = '42501';
  end if;

  return query
  with student_activity as (
    select
      e.user_id as act_user_id,
      e.cohort_id as act_cohort_id,
      coalesce(e.enrolled_at, e.created_at) as act_enrolled_at,
      greatest(
        max(lp.completed_at),
        max(lp.updated_at),
        max(s.created_at),
        max(s.updated_at)
      ) as last_active_at,
      coalesce(
        count(s.id) filter (where s.status in ('resubmit_requested', 'needs_work', 'resubmit')),
        0
      )::int as resub_count,
      coalesce(round(avg(coalesce(lp.watch_percentage, 0)), 1), 0) as avg_watch
    from public.enrollments e
    left join public.lesson_progress lp on lp.user_id = e.user_id
    left join public.submissions s on s.student_id = e.user_id
    where e.status in ('active', 'enrolled')
      and (p_cohort_id is null or e.cohort_id = p_cohort_id)
    group by e.user_id, e.cohort_id, e.enrolled_at, e.created_at
  ),
  classified as (
    select
      sa.act_user_id as s_id,
      prof.full_name as s_name,
      prof.email::text as s_email,
      sa.act_cohort_id as c_id,
      coalesce(c.title, c.name, 'Cohort') as c_name,
      case
        when sa.last_active_at is not null then
          greatest(1, floor(extract(epoch from (now() - sa.last_active_at)) / 86400))::int
        else
          greatest(1, floor(extract(epoch from (now() - sa.act_enrolled_at)) / 86400))::int
      end as calc_days_inactive,
      sa.resub_count as calc_resub_count,
      sa.avg_watch as calc_watch_pct,
      case
        when sa.resub_count >= 2 then 'multiple_resubmissions'
        when sa.last_active_at is not null and (now() - sa.last_active_at) > interval '7 days' then 'stalled_inactivity'
        when sa.last_active_at is null and (now() - sa.act_enrolled_at) > interval '7 days' then 'unresponsive'
        when sa.avg_watch < 30 and (now() - sa.act_enrolled_at) > interval '4 days' then 'low_progress'
        else null
      end as calc_risk_reason,
      sa.act_enrolled_at as calc_enrolled_at
    from student_activity sa
    join public.profiles prof on prof.id = sa.act_user_id
    join public.cohorts c on c.id = sa.act_cohort_id
  )
  select
    cl.s_id,
    cl.s_name,
    cl.s_email,
    cl.c_id,
    cl.c_name,
    cl.calc_days_inactive,
    cl.calc_resub_count,
    cl.calc_watch_pct,
    cl.calc_risk_reason,
    cl.calc_enrolled_at
  from classified cl
  where cl.calc_risk_reason is not null
  order by cl.calc_days_inactive desc;
end;
$$;

grant execute on function public.get_cohort_at_risk_students(uuid) to authenticated;
