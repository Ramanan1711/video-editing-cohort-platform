-- ==============================================================================
-- supabase/migrations/20260928000024_canonical_internship_reports_schema_and_rpcs.sql
-- Canonical Migration: Formal Internship Reports Schema, Evaluation RPCs,
-- Competency Ratings, LOR Eligibility, and Cohort Evaluation Reporting
-- ==============================================================================

-- 1. Create Formal Internship Reports Table
create table if not exists public.internship_reports (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  evaluator_id uuid references public.profiles(id) on delete set null,
  title text not null default 'Internship Performance & Evaluation Report',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'published', 'archived')),
  composite_score numeric(5,2) not null default 0.0 check (composite_score >= 0 and composite_score <= 100),
  grade text not null default 'Incomplete' check (grade in ('A+', 'A', 'B+', 'B', 'C', 'Incomplete', 'Fail')),
  attendance_rate_pct numeric(5,2) not null default 0.0,
  completed_drills_count integer not null default 0,
  total_drills_count integer not null default 15,
  technical_rating integer default 3 check (technical_rating between 1 and 5),
  consistency_rating integer default 3 check (consistency_rating between 1 and 5),
  creative_rating integer default 3 check (creative_rating between 1 and 5),
  summary_notes text,
  strengths text,
  growth_areas text,
  recommendation text not null default 'recommend' check (recommendation in ('strongly_recommend', 'recommend', 'conditional', 'do_not_recommend')),
  lor_eligible boolean not null default false,
  telemetry_snapshot jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_cohort_student_internship_report unique (cohort_id, student_id)
);

-- 2. Indexes for High-Velocity Querying
create index if not exists idx_internship_reports_cohort on public.internship_reports(cohort_id);
create index if not exists idx_internship_reports_student on public.internship_reports(student_id);
create index if not exists idx_internship_reports_status on public.internship_reports(status);
create index if not exists idx_internship_reports_composite on public.internship_reports(composite_score desc);

-- 3. Row Level Security Policies
alter table public.internship_reports enable row level security;

-- Read policy:
-- Students can read their own reports when published.
-- Admins and assigned mentors can read all reports in their cohorts.
drop policy if exists "Internship reports readable by students and staff" on public.internship_reports;
create policy "Internship reports readable by students and staff"
  on public.internship_reports for select
  to authenticated
  using (
    (student_id = auth.uid() and status in ('published', 'submitted'))
    or public.is_admin()
    or exists (
      select 1 from public.mentor_cohorts mc
      where mc.cohort_id = internship_reports.cohort_id
        and mc.mentor_id = auth.uid()
    )
  );

-- Insert policy:
-- Admins and assigned mentors can create reports.
drop policy if exists "Internship reports insertable by staff" on public.internship_reports;
create policy "Internship reports insertable by staff"
  on public.internship_reports for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.mentor_cohorts mc
      where mc.cohort_id = internship_reports.cohort_id
        and mc.mentor_id = auth.uid()
    )
  );

-- Update policy:
-- Admins and assigned mentors can update reports.
drop policy if exists "Internship reports updatable by staff" on public.internship_reports;
create policy "Internship reports updatable by staff"
  on public.internship_reports for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.mentor_cohorts mc
      where mc.cohort_id = internship_reports.cohort_id
        and mc.mentor_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.mentor_cohorts mc
      where mc.cohort_id = internship_reports.cohort_id
        and mc.mentor_id = auth.uid()
    )
  );

-- Delete policy:
-- Admins only
drop policy if exists "Internship reports deletable by admin" on public.internship_reports;
create policy "Internship reports deletable by admin"
  on public.internship_reports for delete
  to authenticated
  using (public.is_admin());

-- 4. Authoritative Stored Procedure: generate_internship_report
create or replace function public.generate_internship_report(
  p_cohort_id uuid,
  p_student_id uuid,
  p_evaluator_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort record;
  v_student record;
  v_evaluator record;
  v_effective_sprint_days integer := 15;
  v_max_challenge_day integer := 0;
  v_completed_drills integer := 0;
  v_total_drill_score numeric := 0;
  v_scored_drills integer := 0;
  v_drill_avg_score numeric := 0;
  v_drill_pct numeric := 0;
  
  v_total_lessons integer := 0;
  v_completed_lessons integer := 0;
  v_lesson_pct numeric := 100.0;
  
  v_total_assignments integer := 0;
  v_approved_assignments integer := 0;
  v_assignment_pct numeric := 100.0;
  
  v_total_sessions integer := 0;
  v_attended_sessions integer := 0;
  v_attendance_pct numeric := 100.0;
  
  v_composite_score numeric(5,2) := 0.0;
  v_grade text := 'Incomplete';
  v_lor_eligible boolean := false;
  v_report_record record;
  v_drills_snapshot jsonb;
begin
  -- 1. Validate Cohort & Student existence
  select * from public.cohorts where id = p_cohort_id into v_cohort;
  if v_cohort.id is null then
    raise exception 'Cohort % not found', p_cohort_id;
  end if;

  select * from public.profiles where id = p_student_id into v_student;
  if v_student.id is null then
    raise exception 'Student profile % not found', p_student_id;
  end if;

  -- 2. Determine sprint duration
  select coalesce(max(day_number), 0) from public.daily_challenges where cohort_id = p_cohort_id into v_max_challenge_day;
  v_effective_sprint_days := greatest(coalesce(v_cohort.sprint_duration_days, 15), v_max_challenge_day, 1);

  -- 3. Gather daily challenge submissions telemetry
  select 
    count(case when s.status = 'accepted' then 1 end),
    coalesce(sum(case when s.score is not null then s.score else 0 end), 0),
    count(case when s.score is not null then 1 end)
  into 
    v_completed_drills,
    v_total_drill_score,
    v_scored_drills
  from public.daily_challenges c
  left join public.daily_challenge_submissions s 
    on s.challenge_id = c.id and s.user_id = p_student_id
  where c.cohort_id = p_cohort_id;

  if v_scored_drills > 0 then
    v_drill_avg_score := v_total_drill_score / v_scored_drills;
  else
    v_drill_avg_score := case when v_completed_drills > 0 then 85.0 else 0.0 end;
  end if;
  v_drill_pct := least(100.0, round((v_completed_drills::numeric / v_effective_sprint_days::numeric) * 100.0, 2));

  -- Build drills array snapshot
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'day_number', c.day_number,
      'title', c.title,
      'status', coalesce(s.status, 'unsubmitted'),
      'score', s.score,
      'feedback', s.mentor_feedback,
      'submitted_at', s.submitted_at,
      'reviewed_at', s.reviewed_at
    ) order by c.day_number asc
  ), '[]'::jsonb)
  into v_drills_snapshot
  from public.daily_challenges c
  left join public.daily_challenge_submissions s 
    on s.challenge_id = c.id and s.user_id = p_student_id
  where c.cohort_id = p_cohort_id;

  -- 4. Gather curriculum lesson watch telemetry
  select count(l.id)
  into v_total_lessons
  from public.modules m
  join public.lessons l on l.module_id = m.id
  where m.cohort_id = p_cohort_id;

  if v_total_lessons > 0 then
    select count(distinct lp.lesson_id)
    into v_completed_lessons
    from public.modules m
    join public.lessons l on l.module_id = m.id
    join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = p_student_id
    where m.cohort_id = p_cohort_id
      and (lp.completed = true or coalesce(lp.watch_percentage, 0) >= 80);
    v_lesson_pct := round((v_completed_lessons::numeric / v_total_lessons::numeric) * 100.0, 2);
  else
    v_completed_lessons := 0;
    v_lesson_pct := 100.0;
  end if;

  -- 5. Gather capstone assignments telemetry
  select count(a.id)
  into v_total_assignments
  from public.assignments a
  where a.cohort_id = p_cohort_id;

  if v_total_assignments > 0 then
    select count(distinct sub.assignment_id)
    into v_approved_assignments
    from public.assignments a
    join public.submissions sub on sub.assignment_id = a.id and sub.student_id = p_student_id
    where a.cohort_id = p_cohort_id
      and sub.status in ('reviewed', 'accepted', 'approved');
    v_assignment_pct := round((v_approved_assignments::numeric / v_total_assignments::numeric) * 100.0, 2);
  else
    v_approved_assignments := 0;
    v_assignment_pct := 100.0;
  end if;

  -- 6. Gather live workshop attendance telemetry
  select count(ls.id)
  into v_total_sessions
  from public.live_sessions ls
  where (ls.cohort_id = p_cohort_id or ls.cohort_id is null)
    and ls.starts_at <= now();

  if v_total_sessions > 0 then
    select count(distinct sa.session_id)
    into v_attended_sessions
    from public.live_sessions ls
    join public.session_attendance sa on sa.session_id = ls.id and sa.student_id = p_student_id
    where (ls.cohort_id = p_cohort_id or ls.cohort_id is null)
      and ls.starts_at <= now()
      and sa.status in ('present', 'late', 'excused');
    v_attendance_pct := round((v_attended_sessions::numeric / v_total_sessions::numeric) * 100.0, 2);
  else
    v_attended_sessions := 0;
    v_attendance_pct := 100.0;
  end if;

  -- 7. Calculate composite weighted score
  -- Weighting: 40% Sprint Drills + 30% Capstone Assignments + 15% Lessons + 15% Attendance
  v_composite_score := round(
    (v_drill_pct * 0.40) +
    (v_assignment_pct * 0.30) +
    (v_lesson_pct * 0.15) +
    (v_attendance_pct * 0.15),
    2
  );

  -- 8. Calculate Grade & LOR Eligibility
  if v_completed_drills < (v_effective_sprint_days * 0.5) then
    v_grade := 'Incomplete';
  elsif v_composite_score >= 90.0 then
    v_grade := 'A+';
  elsif v_composite_score >= 80.0 then
    v_grade := 'A';
  elsif v_composite_score >= 70.0 then
    v_grade := 'B+';
  elsif v_composite_score >= 60.0 then
    v_grade := 'B';
  elsif v_composite_score >= 50.0 then
    v_grade := 'C';
  else
    v_grade := 'Fail';
  end if;

  -- LOR certification requires high performance across drills and attendance
  v_lor_eligible := (v_composite_score >= 85.0 and v_attendance_pct >= 75.0 and v_completed_drills >= (v_effective_sprint_days * 0.8));

  -- 9. Upsert report record
  insert into public.internship_reports (
    cohort_id,
    student_id,
    evaluator_id,
    title,
    status,
    composite_score,
    grade,
    attendance_rate_pct,
    completed_drills_count,
    total_drills_count,
    technical_rating,
    consistency_rating,
    creative_rating,
    summary_notes,
    strengths,
    growth_areas,
    recommendation,
    lor_eligible,
    telemetry_snapshot,
    generated_at,
    updated_at
  )
  values (
    p_cohort_id,
    p_student_id,
    p_evaluator_id,
    'Internship Performance & Evaluation Report',
    'draft',
    v_composite_score,
    v_grade,
    v_attendance_pct,
    v_completed_drills,
    v_effective_sprint_days,
    case when v_composite_score >= 85 then 5 when v_composite_score >= 70 then 4 else 3 end,
    case when v_drill_pct >= 90 then 5 when v_drill_pct >= 75 then 4 else 3 end,
    case when v_assignment_pct >= 85 then 5 when v_assignment_pct >= 70 then 4 else 3 end,
    'Automated performance evaluation snapshot generated based on daily sprint drills, capstone milestones, and workshop participation.',
    case when v_composite_score >= 80 then 'Consistent daily submission cadence and strong execution of creative briefs.' else 'Shows potential in foundational video editing drills.' end,
    case when v_attendance_pct < 80 then 'Improve live workshop attendance and peer feedback collaboration.' else 'Continue refining advanced pacing and sound design layering.' end,
    case when v_lor_eligible then 'strongly_recommend' when v_composite_score >= 70 then 'recommend' else 'conditional' end,
    v_lor_eligible,
    jsonb_build_object(
      'total_drills', v_effective_sprint_days,
      'completed_drills', v_completed_drills,
      'drill_avg_score', v_drill_avg_score,
      'total_lessons', v_total_lessons,
      'completed_lessons', v_completed_lessons,
      'total_assignments', v_total_assignments,
      'approved_assignments', v_approved_assignments,
      'total_sessions', v_total_sessions,
      'attended_sessions', v_attended_sessions,
      'drills_list', v_drills_snapshot
    ),
    now(),
    now()
  )
  on conflict (cohort_id, student_id)
  do update set
    composite_score = excluded.composite_score,
    grade = excluded.grade,
    attendance_rate_pct = excluded.attendance_rate_pct,
    completed_drills_count = excluded.completed_drills_count,
    total_drills_count = excluded.total_drills_count,
    lor_eligible = excluded.lor_eligible,
    telemetry_snapshot = excluded.telemetry_snapshot,
    updated_at = now()
  returning * into v_report_record;

  return jsonb_build_object(
    'id', v_report_record.id,
    'cohort_id', v_report_record.cohort_id,
    'student_id', v_report_record.student_id,
    'student_name', v_student.full_name,
    'student_email', v_student.email,
    'cohort_name', coalesce(v_cohort.name, v_cohort.title),
    'evaluator_id', v_report_record.evaluator_id,
    'title', v_report_record.title,
    'status', v_report_record.status,
    'composite_score', v_report_record.composite_score,
    'grade', v_report_record.grade,
    'attendance_rate_pct', v_report_record.attendance_rate_pct,
    'completed_drills_count', v_report_record.completed_drills_count,
    'total_drills_count', v_report_record.total_drills_count,
    'technical_rating', v_report_record.technical_rating,
    'consistency_rating', v_report_record.consistency_rating,
    'creative_rating', v_report_record.creative_rating,
    'summary_notes', v_report_record.summary_notes,
    'strengths', v_report_record.strengths,
    'growth_areas', v_report_record.growth_areas,
    'recommendation', v_report_record.recommendation,
    'lor_eligible', v_report_record.lor_eligible,
    'telemetry_snapshot', v_report_record.telemetry_snapshot,
    'generated_at', v_report_record.generated_at,
    'published_at', v_report_record.published_at
  );
end;
$$;

grant execute on function public.generate_internship_report(uuid, uuid, uuid) to authenticated;

-- 5. Stored Procedure: get_cohort_internship_report_summary
create or replace function public.get_cohort_internship_report_summary(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort record;
  v_total_enrolled integer := 0;
  v_reports_generated integer := 0;
  v_published_count integer := 0;
  v_avg_composite numeric(5,2) := 0.0;
  v_lor_count integer := 0;
  v_grade_distribution jsonb;
  v_reports jsonb;
begin
  select * from public.cohorts where id = p_cohort_id into v_cohort;
  if v_cohort.id is null then
    raise exception 'Cohort % not found', p_cohort_id;
  end if;

  select count(*) from public.enrollments where cohort_id = p_cohort_id into v_total_enrolled;

  select 
    count(r.id),
    count(case when r.status = 'published' then 1 end),
    coalesce(round(avg(r.composite_score), 2), 0.0),
    count(case when r.lor_eligible = true then 1 end)
  into
    v_reports_generated,
    v_published_count,
    v_avg_composite,
    v_lor_count
  from public.internship_reports r
  where r.cohort_id = p_cohort_id;

  select jsonb_build_object(
    'A_plus', count(case when r.grade = 'A+' then 1 end),
    'A', count(case when r.grade = 'A' then 1 end),
    'B_plus', count(case when r.grade = 'B+' then 1 end),
    'B', count(case when r.grade = 'B' then 1 end),
    'C', count(case when r.grade = 'C' then 1 end),
    'Incomplete', count(case when r.grade = 'Incomplete' then 1 end)
  )
  into v_grade_distribution
  from public.internship_reports r
  where r.cohort_id = p_cohort_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'student_id', r.student_id,
      'student_name', p.full_name,
      'student_email', p.email,
      'status', r.status,
      'composite_score', r.composite_score,
      'grade', r.grade,
      'attendance_rate_pct', r.attendance_rate_pct,
      'completed_drills_count', r.completed_drills_count,
      'total_drills_count', r.total_drills_count,
      'lor_eligible', r.lor_eligible,
      'recommendation', r.recommendation,
      'updated_at', r.updated_at
    ) order by r.composite_score desc
  ), '[]'::jsonb)
  into v_reports
  from public.internship_reports r
  join public.profiles p on p.id = r.student_id
  where r.cohort_id = p_cohort_id;

  return jsonb_build_object(
    'cohort_id', v_cohort.id,
    'cohort_name', coalesce(v_cohort.name, v_cohort.title),
    'total_enrolled', v_total_enrolled,
    'reports_generated', v_reports_generated,
    'published_count', v_published_count,
    'avg_composite_score', v_avg_composite,
    'lor_eligible_count', v_lor_count,
    'grade_distribution', v_grade_distribution,
    'reports', v_reports
  );
end;
$$;

grant execute on function public.get_cohort_internship_report_summary(uuid) to authenticated;

-- 6. Stored Procedure: publish_internship_report
create or replace function public.publish_internship_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report record;
  v_cohort record;
begin
  update public.internship_reports
  set 
    status = 'published',
    published_at = now(),
    updated_at = now()
  where id = p_report_id
  returning * into v_report;

  if v_report.id is null then
    raise exception 'Internship report % not found', p_report_id;
  end if;

  select * from public.cohorts where id = v_report.cohort_id into v_cohort;

  -- Dispatch notification to the student
  perform public.dispatch_notification(
    v_report.student_id,
    'Official Internship Report Card Published',
    'Your mentor has finalized and published your performance report and evaluation for ' || coalesce(v_cohort.name, v_cohort.title, 'your cohort') || '.',
    'internship_report_published',
    '/student/dashboard?tab=internship_report',
    jsonb_build_object(
      'report_id', v_report.id,
      'cohort_id', v_report.cohort_id,
      'grade', v_report.grade,
      'composite_score', v_report.composite_score,
      'lor_eligible', v_report.lor_eligible
    )
  );

  return jsonb_build_object(
    'id', v_report.id,
    'status', v_report.status,
    'published_at', v_report.published_at,
    'grade', v_report.grade,
    'composite_score', v_report.composite_score,
    'lor_eligible', v_report.lor_eligible
  );
end;
$$;

grant execute on function public.publish_internship_report(uuid) to authenticated;
