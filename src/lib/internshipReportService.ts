import { supabase } from './supabaseClient';

export interface InternshipDrillSnapshot {
  day_number: number;
  title: string;
  status: string;
  score: number | null;
  feedback: string | null;
  submitted_at?: string;
  reviewed_at?: string;
}

export interface InternshipReportTelemetrySnapshot {
  total_drills: number;
  completed_drills: number;
  drill_avg_score: number;
  total_lessons: number;
  completed_lessons: number;
  total_assignments: number;
  approved_assignments: number;
  total_sessions: number;
  attended_sessions: number;
  drills_list: InternshipDrillSnapshot[];
}

export interface InternshipReport {
  id: string;
  cohort_id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  cohort_name?: string;
  evaluator_id?: string | null;
  evaluator_name?: string | null;
  title: string;
  status: 'draft' | 'submitted' | 'published' | 'archived';
  composite_score: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'Incomplete' | 'Fail';
  attendance_rate_pct: number;
  completed_drills_count: number;
  total_drills_count: number;
  technical_rating: number; // 1-5
  consistency_rating: number; // 1-5
  creative_rating: number; // 1-5
  summary_notes: string | null;
  strengths: string | null;
  growth_areas: string | null;
  recommendation: 'strongly_recommend' | 'recommend' | 'conditional' | 'do_not_recommend';
  lor_eligible: boolean;
  telemetry_snapshot: InternshipReportTelemetrySnapshot;
  generated_at: string;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InternshipReportInput {
  title?: string;
  status?: 'draft' | 'submitted' | 'published' | 'archived';
  technical_rating?: number;
  consistency_rating?: number;
  creative_rating?: number;
  summary_notes?: string;
  strengths?: string;
  growth_areas?: string;
  recommendation?: 'strongly_recommend' | 'recommend' | 'conditional' | 'do_not_recommend';
}

export interface CohortInternshipSummaryReport {
  cohort_id: string;
  cohort_name: string;
  total_enrolled: number;
  reports_generated: number;
  published_count: number;
  avg_composite_score: number;
  lor_eligible_count: number;
  grade_distribution: {
    A_plus: number;
    A: number;
    B_plus: number;
    B: number;
    C: number;
    Incomplete: number;
  };
  reports: Array<{
    id: string;
    student_id: string;
    student_name: string;
    student_email: string;
    status: string;
    composite_score: number;
    grade: string;
    attendance_rate_pct: number;
    completed_drills_count: number;
    total_drills_count: number;
    lor_eligible: boolean;
    recommendation: string;
    updated_at: string;
  }>;
}

/**
 * 1. Generate or re-generate authoritative internship evaluation report
 */
export async function generateInternshipReport(
  cohortId: string,
  studentId: string,
  evaluatorId?: string
): Promise<InternshipReport> {
  // 1. Try authoritative PostgreSQL RPC
  try {
    const { data, error } = await supabase.rpc('generate_internship_report', {
      p_cohort_id: cohortId,
      p_student_id: studentId,
      p_evaluator_id: evaluatorId || null,
    });

    if (!error && data) {
      return data as InternshipReport;
    }
  } catch (err) {
    console.warn('RPC generate_internship_report unavailable, running client fallback:', err);
  }

  // 2. Client-side Fallback Evaluation
  const [
    cohortRes,
    studentRes,
    challengesRes,
    subsRes,
    modulesRes,
    progressRes,
    assignmentsRes,
    assignSubsRes,
    sessionsRes,
    attendanceRes,
  ] = await Promise.all([
    supabase.from('cohorts').select('id, name, title, sprint_duration_days').eq('id', cohortId).maybeSingle(),
    supabase.from('profiles').select('id, full_name, email').eq('id', studentId).maybeSingle(),
    supabase.from('daily_challenges').select('id, day_number, title').eq('cohort_id', cohortId).order('day_number'),
    supabase.from('daily_challenge_submissions').select('*').eq('user_id', studentId),
    supabase.from('modules').select('id, lessons(id)').eq('cohort_id', cohortId),
    supabase.from('lesson_progress').select('lesson_id, completed, watch_percentage').eq('user_id', studentId),
    supabase.from('assignments').select('id').eq('cohort_id', cohortId),
    supabase.from('submissions').select('assignment_id, status').eq('student_id', studentId),
    supabase.from('live_sessions').select('id').or(`cohort_id.eq.${cohortId},cohort_id.is.null`).lte('starts_at', new Date().toISOString()),
    supabase.from('session_attendance').select('session_id, status').eq('student_id', studentId),
  ]);

  const cohort = cohortRes.data;
  const student = studentRes.data;
  const cohortName = cohort?.name || cohort?.title || 'Internship Cohort';
  const studentName = student?.full_name || 'Intern';
  const studentEmail = student?.email || '';

  // Daily Drills Telemetry
  const challenges = challengesRes.data ?? [];
  const maxDay = challenges.length > 0 ? Math.max(...challenges.map((c) => c.day_number)) : 0;
  const sprintDays = Math.max(cohort?.sprint_duration_days || 15, maxDay, 1);
  const submissions = subsRes.data ?? [];
  const subMap = new Map(submissions.map((s) => [s.challenge_id, s]));

  let completedDrills = 0;
  let totalDrillScore = 0;
  let scoredDrills = 0;
  const drillsList: InternshipDrillSnapshot[] = [];

  for (const c of challenges) {
    const sub = subMap.get(c.id);
    if (sub && sub.status === 'accepted') {
      completedDrills++;
    }
    if (sub && sub.score !== null && sub.score !== undefined) {
      totalDrillScore += sub.score;
      scoredDrills++;
    }
    drillsList.push({
      day_number: c.day_number,
      title: c.title,
      status: sub ? sub.status : 'unsubmitted',
      score: sub?.score ?? null,
      feedback: sub?.mentor_feedback ?? null,
      submitted_at: sub?.submitted_at,
      reviewed_at: sub?.reviewed_at,
    });
  }

  const drillPct = Math.min(100, Math.round((completedDrills / sprintDays) * 100));
  const avgDrillScore = scoredDrills > 0 ? Math.round(totalDrillScore / scoredDrills) : (completedDrills > 0 ? 85 : 0);

  // Lessons Telemetry
  const allLessons = (modulesRes.data ?? []).flatMap((m) => (m.lessons as Array<{ id: string }> ?? []));
  const progMap = new Map((progressRes.data ?? []).map((p) => [p.lesson_id, p]));
  const completedLessons = allLessons.filter((l) => {
    const prog = progMap.get(l.id);
    return prog && (prog.completed || (prog.watch_percentage ?? 0) >= 80);
  }).length;
  const lessonPct = allLessons.length > 0 ? Math.round((completedLessons / allLessons.length) * 100) : 100;

  // Assignments Telemetry
  const allAssignments = assignmentsRes.data ?? [];
  const approvedAssigns = (assignSubsRes.data ?? []).filter((s) => ['reviewed', 'accepted', 'approved'].includes(s.status)).length;
  const assignPct = allAssignments.length > 0 ? Math.round((approvedAssigns / allAssignments.length) * 100) : 100;

  // Attendance Telemetry
  const heldSessions = sessionsRes.data ?? [];
  const heldSet = new Set(heldSessions.map((s) => s.id));
  const attendedCount = (attendanceRes.data ?? []).filter((a) => heldSet.has(a.session_id) && ['present', 'late', 'excused'].includes(a.status)).length;
  const attendancePct = heldSessions.length > 0 ? Math.round((attendedCount / heldSessions.length) * 100) : 100;

  // Composite Calculation: 40% Drills + 30% Projects + 15% Lessons + 15% Attendance
  const compositeScore = Math.round(
    (drillPct * 0.40) +
    (assignPct * 0.30) +
    (lessonPct * 0.15) +
    (attendancePct * 0.15)
  );

  let grade: InternshipReport['grade'] = 'Incomplete';
  if (completedDrills < sprintDays * 0.5) {
    grade = 'Incomplete';
  } else if (compositeScore >= 90) {
    grade = 'A+';
  } else if (compositeScore >= 80) {
    grade = 'A';
  } else if (compositeScore >= 70) {
    grade = 'B+';
  } else if (compositeScore >= 60) {
    grade = 'B';
  } else if (compositeScore >= 50) {
    grade = 'C';
  } else {
    grade = 'Fail';
  }

  const lorEligible = compositeScore >= 85 && attendancePct >= 75 && completedDrills >= Math.floor(sprintDays * 0.8);
  const recommendation = lorEligible ? 'strongly_recommend' : compositeScore >= 70 ? 'recommend' : 'conditional';

  const telemetrySnapshot: InternshipReportTelemetrySnapshot = {
    total_drills: sprintDays,
    completed_drills: completedDrills,
    drill_avg_score: avgDrillScore,
    total_lessons: allLessons.length,
    completed_lessons: completedLessons,
    total_assignments: allAssignments.length,
    approved_assignments: approvedAssigns,
    total_sessions: heldSessions.length,
    attended_sessions: attendedCount,
    drills_list: drillsList,
  };

  const { data: savedReport, error: saveErr } = await supabase
    .from('internship_reports')
    .upsert({
      cohort_id: cohortId,
      student_id: studentId,
      evaluator_id: evaluatorId || null,
      title: 'Internship Performance & Evaluation Report',
      status: 'draft',
      composite_score: compositeScore,
      grade,
      attendance_rate_pct: attendancePct,
      completed_drills_count: completedDrills,
      total_drills_count: sprintDays,
      technical_rating: compositeScore >= 85 ? 5 : compositeScore >= 70 ? 4 : 3,
      consistency_rating: drillPct >= 90 ? 5 : drillPct >= 75 ? 4 : 3,
      creative_rating: assignPct >= 85 ? 5 : assignPct >= 70 ? 4 : 3,
      summary_notes: 'Performance evaluation generated based on daily sprint drills, capstone projects, and workshop participation.',
      strengths: compositeScore >= 80 ? 'Demonstrated strong editing cadence, turnaround velocity, and technical proficiency.' : 'Foundational competency in timeline assembly and video cutting.',
      growth_areas: attendancePct < 80 ? 'Active workshop participation and community feedback loop.' : 'Advanced audio mastering and narrative pacing retention.',
      recommendation,
      lor_eligible: lorEligible,
      telemetry_snapshot: telemetrySnapshot,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cohort_id,student_id' })
    .select('*')
    .single();

  if (saveErr || !savedReport) {
    console.warn('Failed to upsert internship report to database, returning local model:', saveErr);
    return {
      id: `local-report-${studentId}`,
      cohort_id: cohortId,
      student_id: studentId,
      student_name: studentName,
      student_email: studentEmail,
      cohort_name: cohortName,
      title: 'Internship Performance & Evaluation Report',
      status: 'draft',
      composite_score: compositeScore,
      grade,
      attendance_rate_pct: attendancePct,
      completed_drills_count: completedDrills,
      total_drills_count: sprintDays,
      technical_rating: compositeScore >= 85 ? 5 : compositeScore >= 70 ? 4 : 3,
      consistency_rating: drillPct >= 90 ? 5 : drillPct >= 75 ? 4 : 3,
      creative_rating: assignPct >= 85 ? 5 : assignPct >= 70 ? 4 : 3,
      summary_notes: 'Performance evaluation generated based on daily sprint drills, capstone projects, and workshop participation.',
      strengths: 'Foundational editing skills demonstrated across cohort drills.',
      growth_areas: 'Continued mastery of pacing and motion graphics.',
      recommendation,
      lor_eligible: lorEligible,
      telemetry_snapshot: telemetrySnapshot,
      generated_at: new Date().toISOString(),
    };
  }

  return {
    ...savedReport,
    student_name: studentName,
    student_email: studentEmail,
    cohort_name: cohortName,
  } as InternshipReport;
}

/**
 * 2. Get single student's report in a cohort
 */
export async function getStudentInternshipReport(
  cohortId: string,
  studentId: string
): Promise<InternshipReport | null> {
  try {
    const { data: report, error } = await supabase
      .from('internship_reports')
      .select('*, profiles:student_id(full_name, email), cohorts:cohort_id(name, title)')
      .eq('cohort_id', cohortId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (error || !report) {
      return null;
    }

    const p = report.profiles as { full_name?: string; email?: string } | null;
    const c = report.cohorts as { name?: string; title?: string } | null;

    return {
      ...report,
      student_name: p?.full_name || 'Intern',
      student_email: p?.email || '',
      cohort_name: c?.name || c?.title || 'Internship Cohort',
    } as InternshipReport;
  } catch (err) {
    console.warn('getStudentInternshipReport failed:', err);
    return null;
  }
}

/**
 * 3. List all internship reports for a cohort
 */
export async function listCohortInternshipReports(cohortId: string): Promise<InternshipReport[]> {
  try {
    const { data, error } = await supabase
      .from('internship_reports')
      .select('*, profiles:student_id(full_name, email), cohorts:cohort_id(name, title)')
      .eq('cohort_id', cohortId)
      .order('composite_score', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((r) => {
      const p = r.profiles as { full_name?: string; email?: string } | null;
      const c = r.cohorts as { name?: string; title?: string } | null;
      return {
        ...r,
        student_name: p?.full_name || 'Intern',
        student_email: p?.email || '',
        cohort_name: c?.name || c?.title || 'Internship Cohort',
      };
    }) as InternshipReport[];
  } catch (err) {
    console.warn('listCohortInternshipReports failed:', err);
    return [];
  }
}

/**
 * 4. Get cohort executive internship report summary
 */
export async function getCohortInternshipReportSummary(
  cohortId: string
): Promise<CohortInternshipSummaryReport> {
  // 1. Try authoritative RPC
  try {
    const { data, error } = await supabase.rpc('get_cohort_internship_report_summary', {
      p_cohort_id: cohortId,
    });
    if (!error && data) {
      return data as CohortInternshipSummaryReport;
    }
  } catch (err) {
    console.warn('RPC get_cohort_internship_report_summary failed, falling back:', err);
  }

  // 2. Direct Query Fallback
  const [cohortRes, enrollsRes, reports] = await Promise.all([
    supabase.from('cohorts').select('id, name, title').eq('id', cohortId).maybeSingle(),
    supabase.from('enrollments').select('id').eq('cohort_id', cohortId),
    listCohortInternshipReports(cohortId),
  ]);

  const cohort = cohortRes.data;
  const totalEnrolled = enrollsRes.data?.length || 0;
  const publishedCount = reports.filter((r) => r.status === 'published').length;
  const avgComposite = reports.length > 0
    ? Math.round((reports.reduce((acc, r) => acc + (r.composite_score || 0), 0) / reports.length) * 10) / 10
    : 0;
  const lorCount = reports.filter((r) => r.lor_eligible).length;

  const gradeDist = {
    A_plus: reports.filter((r) => r.grade === 'A+').length,
    A: reports.filter((r) => r.grade === 'A').length,
    B_plus: reports.filter((r) => r.grade === 'B+').length,
    B: reports.filter((r) => r.grade === 'B').length,
    C: reports.filter((r) => r.grade === 'C').length,
    Incomplete: reports.filter((r) => r.grade === 'Incomplete' || r.grade === 'Fail').length,
  };

  return {
    cohort_id: cohortId,
    cohort_name: cohort?.name || cohort?.title || 'Cohort',
    total_enrolled: totalEnrolled,
    reports_generated: reports.length,
    published_count: publishedCount,
    avg_composite_score: avgComposite,
    lor_eligible_count: lorCount,
    grade_distribution: gradeDist,
    reports: reports.map((r) => ({
      id: r.id,
      student_id: r.student_id,
      student_name: r.student_name || 'Intern',
      student_email: r.student_email || '',
      status: r.status,
      composite_score: r.composite_score,
      grade: r.grade,
      attendance_rate_pct: r.attendance_rate_pct,
      completed_drills_count: r.completed_drills_count,
      total_drills_count: r.total_drills_count,
      lor_eligible: r.lor_eligible,
      recommendation: r.recommendation,
      updated_at: r.updated_at || r.generated_at,
    })),
  };
}

/**
 * 5. Update qualitative ratings or remarks on an existing report
 */
export async function updateInternshipReport(
  reportId: string,
  updates: Partial<InternshipReportInput>
): Promise<InternshipReport> {
  const { data, error } = await supabase
    .from('internship_reports')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select('*, profiles:student_id(full_name, email), cohorts:cohort_id(name, title)')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update internship report');
  }

  const p = data.profiles as { full_name?: string; email?: string } | null;
  const c = data.cohorts as { name?: string; title?: string } | null;

  return {
    ...data,
    student_name: p?.full_name || 'Intern',
    student_email: p?.email || '',
    cohort_name: c?.name || c?.title || 'Cohort',
  } as InternshipReport;
}

/**
 * 6. Publish report to the student and dispatch notification
 */
export async function publishInternshipReport(reportId: string): Promise<InternshipReport> {
  // 1. Try authoritative RPC
  try {
    const { data, error } = await supabase.rpc('publish_internship_report', {
      p_report_id: reportId,
    });
    if (!error && data) {
      const full = await supabase
        .from('internship_reports')
        .select('*, profiles:student_id(full_name, email), cohorts:cohort_id(name, title)')
        .eq('id', reportId)
        .single();
      if (full.data) {
        const p = full.data.profiles as { full_name?: string; email?: string } | null;
        const c = full.data.cohorts as { name?: string; title?: string } | null;
        return {
          ...full.data,
          student_name: p?.full_name || 'Intern',
          student_email: p?.email || '',
          cohort_name: c?.name || c?.title || 'Cohort',
        } as InternshipReport;
      }
    }
  } catch (err) {
    console.warn('RPC publish_internship_report failed, running fallback:', err);
  }

  // 2. Direct Update Fallback
  const { data, error } = await supabase
    .from('internship_reports')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select('*, profiles:student_id(full_name, email), cohorts:cohort_id(name, title)')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to publish internship report');
  }

  // Optional: dispatch notification
  try {
    await supabase.from('notifications').insert({
      user_id: data.student_id,
      title: 'Official Internship Report Card Published',
      body: 'Your mentor has finalized and published your performance report and evaluation.',
      message: 'Your mentor has finalized and published your performance report and evaluation.',
      category: 'internship_report_published',
      type: 'internship_report_published',
      action_url: '/student/dashboard?tab=internship_report',
    });
  } catch {
    // Ignore notification insert failure in fallback
  }

  const p = data.profiles as { full_name?: string; email?: string } | null;
  const c = data.cohorts as { name?: string; title?: string } | null;

  return {
    ...data,
    student_name: p?.full_name || 'Intern',
    student_email: p?.email || '',
    cohort_name: c?.name || c?.title || 'Cohort',
  } as InternshipReport;
}

/**
 * 7. Export formal cohort internship reports as standard CSV
 */
export function exportCohortInternshipReportsCSV(
  cohortName: string,
  reports: InternshipReport[]
): string {
  const headers = [
    'Student Name',
    'Student Email',
    'Cohort',
    'Report Status',
    'Final Grade',
    'Composite Score (%)',
    'Drills Completed',
    'Total Drills',
    'Live Workshop Attendance (%)',
    'Technical Rating (1-5)',
    'Consistency Rating (1-5)',
    'Creative Rating (1-5)',
    'LOR Eligible',
    'Recommendation',
    'Date Evaluated',
    'Published Date',
  ];

  const escapeCSV = (val: unknown) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = reports.map((r) => [
    escapeCSV(r.student_name || 'Intern'),
    escapeCSV(r.student_email || ''),
    escapeCSV(cohortName || r.cohort_name || 'Cohort'),
    escapeCSV(r.status.toUpperCase()),
    escapeCSV(r.grade),
    escapeCSV(r.composite_score),
    escapeCSV(r.completed_drills_count),
    escapeCSV(r.total_drills_count),
    escapeCSV(r.attendance_rate_pct),
    escapeCSV(r.technical_rating),
    escapeCSV(r.consistency_rating),
    escapeCSV(r.creative_rating),
    escapeCSV(r.lor_eligible ? 'YES' : 'NO'),
    escapeCSV(r.recommendation.replace('_', ' ').toUpperCase()),
    escapeCSV(r.generated_at ? new Date(r.generated_at).toLocaleDateString() : ''),
    escapeCSV(r.published_at ? new Date(r.published_at).toLocaleDateString() : 'Unpublished'),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}
