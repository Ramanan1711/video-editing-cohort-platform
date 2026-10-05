-- ==============================================================================
-- Migration: 20261005000004_fix_cohort_reporting_baseline_and_lesson_progress_queries.sql
-- Description: Fix column reference 'lp.id' on public.lesson_progress (which uses
--              composite primary key (user_id, lesson_id) and has no 'id' column)
--              in get_cohort_reporting_baseline, admin_delete_module, and admin_delete_lesson.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Fix get_cohort_reporting_baseline RPC
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
  -- Uses count(*) instead of nonexistent lp.id column
  select
    count(*) filter (where lp.completed = true or coalesce(lp.watch_percentage, 0) >= 80),
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
grant execute on function public.get_cohort_reporting_baseline(uuid) to service_role;

-- ------------------------------------------------------------------------------
-- 2. Fix admin_delete_module RPC
-- ------------------------------------------------------------------------------
create or replace function public.admin_delete_module(
  p_module_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mod record;
  v_submission_count int := 0;
  v_progress_count int := 0;
begin
  if not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: Only active administrators can delete modules.'
      using errcode = '42501';
  end if;

  select id, title, cohort_id, status
  into v_mod
  from public.modules
  where id = p_module_id;

  if not found then
    raise exception 'Module % not found.', p_module_id
      using errcode = 'P0002';
  end if;

  -- Check student submissions linked to lessons within this module
  select count(s.id)
  into v_submission_count
  from public.submissions s
  join public.assignments a on s.assignment_id = a.id
  join public.lessons l on l.id = a.lesson_id
  where l.module_id = p_module_id;

  -- Check lesson watch progress linked to lessons within this module
  select count(*)
  into v_progress_count
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  where l.module_id = p_module_id;

  -- Safety check: archive if student data exists and force is false
  if (v_submission_count > 0 or v_progress_count > 0) and not p_force then
    update public.modules
    set status = 'archived',
        updated_at = now()
    where id = p_module_id;

    perform public.log_audit_event(
      'module.archived_safely',
      'module',
      p_module_id::text,
      jsonb_build_object(
        'title', v_mod.title,
        'submissions', v_submission_count,
        'progress_records', v_progress_count,
        'reason', 'Preserved student progress and submissions; module status switched to archived.'
      )
    );

    return jsonb_build_object(
      'success', true,
      'action', 'archived',
      'message', format(
        'Module "%s" contains %s student submission(s) and %s progress record(s). To protect learner records, it has been marked as Archived rather than permanently deleted.',
        v_mod.title,
        v_submission_count,
        v_progress_count
      )
    );
  end if;

  -- Permitted delete
  delete from public.modules where id = p_module_id;

  perform public.log_audit_event(
    'module.deleted',
    'module',
    p_module_id::text,
    jsonb_build_object(
      'title', v_mod.title,
      'forced', p_force,
      'previous_submissions', v_submission_count,
      'previous_progress_records', v_progress_count
    )
  );

  return jsonb_build_object(
    'success', true,
    'action', 'deleted',
    'message', format('Module "%s" has been permanently deleted.', v_mod.title)
  );
end;
$$;

grant execute on function public.admin_delete_module(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_module(uuid, boolean) to service_role;

-- ------------------------------------------------------------------------------
-- 3. Fix admin_delete_lesson RPC
-- ------------------------------------------------------------------------------
create or replace function public.admin_delete_lesson(
  p_lesson_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson record;
  v_submission_count int := 0;
  v_progress_count int := 0;
begin
  if not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: Only active administrators can delete lessons.'
      using errcode = '42501';
  end if;

  select id, title, module_id, status
  into v_lesson
  from public.lessons
  where id = p_lesson_id;

  if not found then
    raise exception 'Lesson % not found.', p_lesson_id
      using errcode = 'P0002';
  end if;

  -- Check student submissions linked to assignments under this lesson
  select count(s.id)
  into v_submission_count
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where a.lesson_id = p_lesson_id;

  -- Check student progress records
  select count(*)
  into v_progress_count
  from public.lesson_progress lp
  where lp.lesson_id = p_lesson_id;

  -- Safety check: if learner data exists and force is false, archive safely
  if (v_submission_count > 0 or v_progress_count > 0) and not p_force then
    update public.lessons
    set status = 'archived',
        updated_at = now()
    where id = p_lesson_id;

    perform public.log_audit_event(
      'lesson.archived_safely',
      'lesson',
      p_lesson_id::text,
      jsonb_build_object(
        'title', v_lesson.title,
        'submissions', v_submission_count,
        'progress_records', v_progress_count,
        'reason', 'Preserved student records; lesson marked as archived.'
      )
    );

    return jsonb_build_object(
      'success', true,
      'action', 'archived',
      'message', format(
        'Lesson "%s" contains %s student submission(s) and %s progress record(s). To protect learner records, it has been marked as Archived rather than permanently deleted.',
        v_lesson.title,
        v_submission_count,
        v_progress_count
      )
    );
  end if;

  -- Permitted delete
  delete from public.lessons where id = p_lesson_id;

  perform public.log_audit_event(
    'lesson.deleted',
    'lesson',
    p_lesson_id::text,
    jsonb_build_object(
      'title', v_lesson.title,
      'forced', p_force,
      'previous_submissions', v_submission_count,
      'previous_progress_records', v_progress_count
    )
  );

  return jsonb_build_object(
    'success', true,
    'action', 'deleted',
    'message', format('Lesson "%s" has been permanently deleted.', v_lesson.title)
  );
end;
$$;

grant execute on function public.admin_delete_lesson(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_lesson(uuid, boolean) to service_role;
