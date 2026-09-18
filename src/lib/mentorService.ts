import { supabase } from './supabaseClient';
import type { MentorSubmission, FeedbackItem } from './courseService';

export interface RubricScore {
  storytelling: number;
  pacing: number;
  audio: number;
  color: number;
  technical: number;
}

export interface TimestampedNote {
  id: string;
  timestamp_seconds: number;
  formatted_time: string;
  category: 'pacing' | 'audio' | 'color' | 'storytelling' | 'technical' | 'general';
  text: string;
}

export interface DetailedFeedbackItem extends FeedbackItem {
  rubric?: RubricScore;
  timestamped_notes?: TimestampedNote[];
  private_notes?: string | null;
}

export interface DetailedMentorSubmission extends MentorSubmission {
  sla_target_hours?: number;
  escalated_at?: string | null;
  escalation_reason?: string | null;
  escalated_by?: string | null;
  private_notes?: string | null;
  detailed_feedback_history?: DetailedFeedbackItem[];
  waiting_time_hours?: number;
  sla_status?: 'on_track' | 'warning' | 'overdue';
}

export interface MentorStudentProgress {
  student_id: string;
  student_name: string;
  student_email: string;
  cohort_id: string;
  cohort_name: string;
  total_lessons: number;
  completed_lessons: number;
  progress_pct: number;
  total_assignments: number;
  submissions_count: number;
  passed_count: number;
  resubmission_count: number;
  last_activity: string | null;
  needs_attention: boolean;
  attention_reasons: string[];
}

export interface MentorDashboardStats {
  pendingCount: number;
  warningCount: number;
  overdueCount: number;
  reviewedCount: number;
  resubmitCount: number;
  assignedCohorts: { id: string; name: string }[];
  attentionStudentsCount: number;
  avgResponseHours: number | null;
  assignmentWorkload: {
    assignment_id: string;
    title: string;
    cohort_name: string;
    pending_count: number;
  }[];
  recentReviews: DetailedMentorSubmission[];
}

export interface MentorOfficeHour {
  id: string;
  mentor_id: string;
  cohort_id?: string | null;
  cohort_name?: string | null;
  title: string;
  meeting_url: string;
  starts_at: string;
  duration_minutes: number;
  status: 'available' | 'booked' | 'cancelled';
  created_at?: string;
}

export interface MentorMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  cohort_id?: string | null;
  submission_id?: string | null;
  message: string;
  read_at?: string | null;
  created_at: string;
  sender_name?: string;
}

// ----------------------------------------------------------------------------
// 1. Mentor Cohort Scoping & Assignments
// ----------------------------------------------------------------------------

export async function getMentorAssignedCohorts(
  mentorId: string,
  userRole: string
): Promise<{ id: string; name: string }[]> {
  try {
    // If admin, return all active cohorts
    if (userRole === 'admin') {
      const { data, error } = await supabase.from('cohorts').select('id, name').order('name');
      if (error) throw error;
      return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
    }

    // Attempt to query mentor_cohorts
    const { data: assignments, error } = await supabase
      .from('mentor_cohorts')
      .select('cohort_id')
      .eq('mentor_id', mentorId);

    if (error || !assignments || assignments.length === 0) {
      // Fallback: If table doesn't exist yet or mentor hasn't been assigned yet,
      // return all cohorts so mentor is not blocked
      const { data: allCohorts } = await supabase.from('cohorts').select('id, name').order('name');
      return (allCohorts ?? []).map((c) => ({ id: c.id, name: c.name }));
    }

    const cohortIds = assignments.map((a) => a.cohort_id);
    const { data: cohorts, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, name')
      .in('id', cohortIds)
      .order('name');

    if (cohortError) throw cohortError;
    return (cohorts ?? []).map((c) => ({ id: c.id, name: c.name }));
  } catch (err) {
    console.warn('Error resolving assigned cohorts, falling back to all:', err);
    const { data } = await supabase.from('cohorts').select('id, name');
    return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
  }
}

export async function assignMentorToCohort(mentorId: string, cohortId: string): Promise<void> {
  const { error } = await supabase.from('mentor_cohorts').upsert(
    { mentor_id: mentorId, cohort_id: cohortId, assigned_at: new Date().toISOString() },
    { onConflict: 'mentor_id,cohort_id' }
  );
  if (error) throw error;
}

export async function removeMentorFromCohort(mentorId: string, cohortId: string): Promise<void> {
  const { error } = await supabase
    .from('mentor_cohorts')
    .delete()
    .eq('mentor_id', mentorId)
    .eq('cohort_id', cohortId);
  if (error) throw error;
}

export async function listCohortMentors(cohortId: string): Promise<{ id: string; full_name: string; email: string }[]> {
  const { data: assignments, error } = await supabase
    .from('mentor_cohorts')
    .select('mentor_id')
    .eq('cohort_id', cohortId);

  if (error || !assignments || assignments.length === 0) return [];

  const mentorIds = assignments.map((a) => a.mentor_id);
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', mentorIds);

  if (profileErr) throw profileErr;
  return (profiles ?? []) as { id: string; full_name: string; email: string }[];
}

// ----------------------------------------------------------------------------
// 2. Enhanced Mentor Submissions Query with SLA & Feedback Details
// ----------------------------------------------------------------------------

export function calculateSLA(
  createdAtString?: string,
  targetHours: number = 24
): { waitingHours: number; status: 'on_track' | 'warning' | 'overdue' } {
  if (!createdAtString) return { waitingHours: 0, status: 'on_track' };
  const created = new Date(createdAtString).getTime();
  const now = Date.now();
  const waitingHours = Math.max(0, Math.round(((now - created) / (1000 * 60 * 60)) * 10) / 10);

  let status: 'on_track' | 'warning' | 'overdue' = 'on_track';
  if (waitingHours >= targetHours) {
    status = 'overdue';
  } else if (waitingHours >= targetHours * 0.75) {
    status = 'warning';
  }

  return { waitingHours, status };
}

export async function listDetailedMentorSubmissions(
  allowedCohortIds?: string[]
): Promise<DetailedMentorSubmission[]> {
  const { data: rawSubmissions, error } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!rawSubmissions || rawSubmissions.length === 0) return [];

  const submissionIds = rawSubmissions.map((s) => s.id);
  const studentIds = Array.from(new Set(rawSubmissions.map((s) => s.student_id)));
  const assignmentIds = Array.from(new Set(rawSubmissions.map((s) => s.assignment_id)));

  const [{ data: profiles }, { data: assignments }, { data: feedbackData }] = await Promise.all([
    studentIds.length ? supabase.from('profiles').select('id, full_name, email').in('id', studentIds) : { data: [] },
    assignmentIds.length
      ? supabase.from('assignments').select('id, lesson_id, title, instructions, deadline').in('id', assignmentIds)
      : { data: [] },
    submissionIds.length
      ? supabase
          .from('feedback')
          .select('id, submission_id, mentor_id, comments, rubric, timestamped_notes, private_notes, created_at')
          .in('submission_id', submissionIds)
          .order('created_at', { ascending: false })
      : { data: [] },
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const assignmentMap = new Map((assignments ?? []).map((a) => [a.id, a]));

  // Resolve lessons and cohorts for assignments
  const lessonIds = Array.from(new Set((assignments ?? []).map((a) => a.lesson_id)));
  const { data: lessons } = lessonIds.length
    ? await supabase.from('lessons').select('id, module_id').in('id', lessonIds)
    : { data: [] };
  const lessonMap = new Map((lessons ?? []).map((l) => [l.id, l.module_id]));

  const moduleIds = Array.from(new Set((lessons ?? []).map((l) => l.module_id)));
  const { data: modules } = moduleIds.length
    ? await supabase.from('modules').select('id, cohort_id').in('id', moduleIds)
    : { data: [] };
  const moduleMap = new Map((modules ?? []).map((m) => [m.id, m.cohort_id]));

  const cohortIds = Array.from(new Set((modules ?? []).map((m) => m.cohort_id)));
  const { data: cohorts } = cohortIds.length
    ? await supabase.from('cohorts').select('id, name').in('id', cohortIds)
    : { data: [] };
  const cohortMap = new Map((cohorts ?? []).map((c) => [c.id, c.name]));

  // Map feedback
  const feedbackBySub = new Map<string, DetailedFeedbackItem[]>();
  for (const f of feedbackData ?? []) {
    const list = feedbackBySub.get(f.submission_id) || [];
    list.push({
      id: f.id,
      submission_id: f.submission_id,
      mentor_id: f.mentor_id,
      comments: f.comments,
      rubric: f.rubric || {},
      timestamped_notes: Array.isArray(f.timestamped_notes) ? f.timestamped_notes : [],
      private_notes: f.private_notes || null,
      created_at: f.created_at,
    });
    feedbackBySub.set(f.submission_id, list);
  }

  const detailedList: DetailedMentorSubmission[] = [];

  for (const s of rawSubmissions) {
    const student = profileMap.get(s.student_id);
    const assignment = assignmentMap.get(s.assignment_id);
    const moduleId = assignment ? lessonMap.get(assignment.lesson_id) : undefined;
    const cohortId = moduleId ? moduleMap.get(moduleId) : undefined;
    const cohortName = cohortId ? cohortMap.get(cohortId) : 'Cohort';

    // Filter by allowed cohorts if specified
    if (allowedCohortIds && allowedCohortIds.length > 0 && cohortId && !allowedCohortIds.includes(cohortId)) {
      continue;
    }

    const subFeedbackHistory = feedbackBySub.get(s.id) || [];
    const latestFeedback = subFeedbackHistory[0]?.comments || null;
    const targetHours = s.sla_target_hours || 24;
    const { waitingHours, status: slaStatus } = calculateSLA(s.created_at, targetHours);

    detailedList.push({
      id: s.id,
      assignment_id: s.assignment_id,
      student_id: s.student_id,
      file_url: s.file_url,
      status: s.status,
      feedback: latestFeedback,
      feedback_history: subFeedbackHistory,
      detailed_feedback_history: subFeedbackHistory,
      created_at: s.created_at,
      updated_at: s.updated_at,
      student_name: student?.full_name || 'Student',
      student_email: student?.email || '',
      assignment_title: assignment?.title || 'Assignment',
      assignment_instructions: assignment?.instructions || null,
      assignment_deadline: assignment?.deadline || null,
      cohort_name: cohortName,
      sla_target_hours: targetHours,
      escalated_at: s.escalated_at || null,
      escalation_reason: s.escalation_reason || null,
      escalated_by: s.escalated_by || null,
      private_notes: s.private_notes || null,
      waiting_time_hours: waitingHours,
      sla_status: slaStatus,
    });
  }

  return detailedList;
}

// ----------------------------------------------------------------------------
// 3. Mentor Dashboard KPI Aggregator
// ----------------------------------------------------------------------------

export async function getMentorDashboardStats(
  mentorId: string,
  userRole: string
): Promise<MentorDashboardStats> {
  const assignedCohorts = await getMentorAssignedCohorts(mentorId, userRole);
  const cohortIds = assignedCohorts.map((c) => c.id);

  const submissions = await listDetailedMentorSubmissions(cohortIds.length ? cohortIds : undefined);

  let pendingCount = 0;
  let warningCount = 0;
  let overdueCount = 0;
  let reviewedCount = 0;
  let resubmitCount = 0;

  const assignmentWorkloadMap = new Map<
    string,
    { assignment_id: string; title: string; cohort_name: string; pending_count: number }
  >();

  // Turnaround tracking: submission created_at to first feedback created_at
  const turnaroundTimesHours: number[] = [];

  for (const sub of submissions) {
    if (sub.status === 'pending') {
      pendingCount++;
      if (sub.sla_status === 'overdue') overdueCount++;
      else if (sub.sla_status === 'warning') warningCount++;

      const key = sub.assignment_id;
      const current = assignmentWorkloadMap.get(key) || {
        assignment_id: key,
        title: sub.assignment_title || 'Assignment',
        cohort_name: sub.cohort_name || 'Cohort',
        pending_count: 0,
      };
      current.pending_count++;
      assignmentWorkloadMap.set(key, current);
    } else if (sub.status === 'reviewed') {
      reviewedCount++;
    } else if (sub.status === 'resubmit') {
      resubmitCount++;
    }

    if (sub.detailed_feedback_history && sub.detailed_feedback_history.length > 0 && sub.created_at) {
      const subTime = new Date(sub.created_at).getTime();
      // Oldest feedback timestamp
      const firstFeedback = sub.detailed_feedback_history[sub.detailed_feedback_history.length - 1];
      const fbTime = new Date(firstFeedback.created_at).getTime();
      const diffHours = (fbTime - subTime) / (1000 * 60 * 60);
      if (diffHours >= 0 && diffHours < 500) {
        turnaroundTimesHours.push(diffHours);
      }
    }
  }

  const avgResponseHours =
    turnaroundTimesHours.length > 0
      ? Math.round((turnaroundTimesHours.reduce((a, b) => a + b, 0) / turnaroundTimesHours.length) * 10) / 10
      : null;

  // Students requiring attention: >= 2 revisions or pending > 24h
  const attentionStudentIds = new Set<string>();
  for (const s of submissions) {
    if (s.status === 'pending' && s.sla_status === 'overdue') {
      attentionStudentIds.add(s.student_id);
    }
    if (s.detailed_feedback_history && s.detailed_feedback_history.length >= 2) {
      attentionStudentIds.add(s.student_id);
    }
  }

  const recentReviews = submissions
    .filter((s) => s.status === 'reviewed' || s.status === 'resubmit')
    .slice(0, 6);

  return {
    pendingCount,
    warningCount,
    overdueCount,
    reviewedCount,
    resubmitCount,
    assignedCohorts,
    attentionStudentsCount: attentionStudentIds.size,
    avgResponseHours,
    assignmentWorkload: Array.from(assignmentWorkloadMap.values()).sort((a, b) => b.pending_count - a.pending_count),
    recentReviews,
  };
}

// ----------------------------------------------------------------------------
// 4. Student Progress Directory
// ----------------------------------------------------------------------------

export async function listMentorStudents(
  cohortIds?: string[]
): Promise<MentorStudentProgress[]> {
  // Query enrollments
  let enrollmentQuery = supabase.from('enrollments').select('user_id, cohort_id, status, created_at');
  if (cohortIds && cohortIds.length > 0) {
    enrollmentQuery = enrollmentQuery.in('cohort_id', cohortIds);
  }

  const { data: enrollments, error: enrollError } = await enrollmentQuery;
  if (enrollError) throw enrollError;
  if (!enrollments || enrollments.length === 0) return [];

  const studentIds = Array.from(new Set(enrollments.map((e) => e.user_id)));
  const enrolledCohortIds = Array.from(new Set(enrollments.map((e) => e.cohort_id)));

  // Parallel fetch: profiles, cohorts, modules, lessons, lesson_progress, submissions
  const [{ data: profiles }, { data: cohorts }, { data: modules }, { data: progressRows }, { data: submissions }] =
    await Promise.all([
      supabase.from('profiles').select('id, full_name, email').in('id', studentIds),
      supabase.from('cohorts').select('id, name').in('id', enrolledCohortIds),
      supabase.from('modules').select('id, cohort_id').in('cohort_id', enrolledCohortIds),
      supabase.from('lesson_progress').select('user_id, lesson_id, completed, completed_at').in('user_id', studentIds),
      supabase
        .from('submissions')
        .select('id, student_id, assignment_id, status, created_at')
        .in('student_id', studentIds),
    ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const cohortMap = new Map((cohorts ?? []).map((c) => [c.id, c.name]));

  // Resolve lessons and total lessons per cohort
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = moduleIds.length
    ? await supabase.from('lessons').select('id, module_id').in('module_id', moduleIds)
    : { data: [] };

  const moduleToCohort = new Map((modules ?? []).map((m) => [m.id, m.cohort_id]));
  const lessonsPerCohort = new Map<string, string[]>();
  for (const l of lessons ?? []) {
    const cId = moduleToCohort.get(l.module_id);
    if (cId) {
      const list = lessonsPerCohort.get(cId) || [];
      list.push(l.id);
      lessonsPerCohort.set(cId, list);
    }
  }

  // Count assignments per cohort
  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: assignments } = lessonIds.length
    ? await supabase.from('assignments').select('id, lesson_id').in('lesson_id', lessonIds)
    : { data: [] };

  const lessonToCohort = new Map<string, string>();
  for (const l of lessons ?? []) {
    const cId = moduleToCohort.get(l.module_id);
    if (cId) lessonToCohort.set(l.id, cId);
  }

  const assignmentsPerCohort = new Map<string, number>();
  for (const a of assignments ?? []) {
    const cId = lessonToCohort.get(a.lesson_id);
    if (cId) {
      assignmentsPerCohort.set(cId, (assignmentsPerCohort.get(cId) || 0) + 1);
    }
  }

  // Group progress by user
  const progressByUser = new Map<string, Set<string>>();
  const lastActiveByUser = new Map<string, string>();

  for (const p of progressRows ?? []) {
    if (p.completed) {
      const set = progressByUser.get(p.user_id) || new Set<string>();
      set.add(p.lesson_id);
      progressByUser.set(p.user_id, set);
    }
    if (p.completed_at) {
      const prev = lastActiveByUser.get(p.user_id);
      if (!prev || new Date(p.completed_at) > new Date(prev)) {
        lastActiveByUser.set(p.user_id, p.completed_at);
      }
    }
  }

  // Group submissions by user
  const submissionsByUser = new Map<string, { total: number; passed: number; resubmit: number }>();
  for (const s of submissions ?? []) {
    const cur = submissionsByUser.get(s.student_id) || { total: 0, passed: 0, resubmit: 0 };
    cur.total++;
    if (s.status === 'reviewed') cur.passed++;
    if (s.status === 'resubmit') cur.resubmit++;
    submissionsByUser.set(s.student_id, cur);

    if (s.created_at) {
      const prev = lastActiveByUser.get(s.student_id);
      if (!prev || new Date(s.created_at) > new Date(prev)) {
        lastActiveByUser.set(s.student_id, s.created_at);
      }
    }
  }

  const results: MentorStudentProgress[] = [];

  for (const enroll of enrollments) {
    const student = profileMap.get(enroll.user_id);
    if (!student) continue;

    const cohortName = cohortMap.get(enroll.cohort_id) || 'Cohort';
    const cohortLessons = lessonsPerCohort.get(enroll.cohort_id) || [];
    const totalLessons = cohortLessons.length;
    const userCompletedSet = progressByUser.get(enroll.user_id) || new Set();

    let completedInCohort = 0;
    for (const lId of cohortLessons) {
      if (userCompletedSet.has(lId)) completedInCohort++;
    }

    const progressPct = totalLessons > 0 ? Math.round((completedInCohort / totalLessons) * 100) : 0;
    const totalAssignments = assignmentsPerCohort.get(enroll.cohort_id) || 0;
    const subStats = submissionsByUser.get(enroll.user_id) || { total: 0, passed: 0, resubmit: 0 };
    const lastActive = lastActiveByUser.get(enroll.user_id) || null;

    // Attention assessment
    const attentionReasons: string[] = [];
    if (subStats.resubmit >= 2) {
      attentionReasons.push(`${subStats.resubmit} revisions requested`);
    }

    // Check stalled activity (> 5 days inactive)
    if (lastActive) {
      const daysSinceActive = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActive > 5 && progressPct < 100) {
        attentionReasons.push(`Inactive for ${Math.round(daysSinceActive)} days`);
      }
    } else if (progressPct === 0) {
      attentionReasons.push('Has not started curriculum yet');
    }

    results.push({
      student_id: enroll.user_id,
      student_name: student.full_name || 'Student',
      student_email: student.email,
      cohort_id: enroll.cohort_id,
      cohort_name: cohortName,
      total_lessons: totalLessons,
      completed_lessons: completedInCohort,
      progress_pct: progressPct,
      total_assignments: totalAssignments,
      submissions_count: subStats.total,
      passed_count: subStats.passed,
      resubmission_count: subStats.resubmit,
      last_activity: lastActive,
      needs_attention: attentionReasons.length > 0,
      attention_reasons: attentionReasons,
    });
  }

  return results.sort((a, b) => (b.needs_attention ? 1 : 0) - (a.needs_attention ? 1 : 0));
}

// ----------------------------------------------------------------------------
// 5. Submit Detailed Review (v2 with Fallback)
// ----------------------------------------------------------------------------

export async function submitDetailedReview(
  submissionId: string,
  status: 'reviewed' | 'resubmit',
  comments: string,
  rubric?: RubricScore,
  timestampedNotes?: TimestampedNote[],
  privateNotes?: string | null
): Promise<void> {
  try {
    // Attempt enhanced RPC review_submission_v2
    const { error: v2Error } = await supabase.rpc('review_submission_v2', {
      p_submission_id: submissionId,
      p_status: status,
      p_comments: comments.trim() || null,
      p_rubric: rubric || {},
      p_timestamped_notes: timestampedNotes || [],
      p_private_notes: privateNotes?.trim() || null,
    });

    if (!v2Error) return;

    // Fallback: If review_submission_v2 is missing in DB, use review_submission
    const { error: v1Error } = await supabase.rpc('review_submission', {
      p_submission_id: submissionId,
      p_status: status,
      p_comments: comments.trim() || null,
    });

    if (v1Error) throw v1Error;

    // Best-effort update of private notes
    if (privateNotes) {
      await supabase
        .from('submissions')
        .update({ private_notes: privateNotes.trim() })
        .eq('id', submissionId);
    }
  } catch (err) {
    console.error('Error in submitDetailedReview:', err);
    throw new Error(err instanceof Error ? err.message : 'Unable to submit review.', { cause: err });
  }
}

export async function escalateSubmissionToAdmin(
  submissionId: string,
  mentorId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('submissions')
    .update({
      escalated_at: new Date().toISOString(),
      escalation_reason: reason.trim(),
      escalated_by: mentorId,
    })
    .eq('id', submissionId);

  if (error) throw error;
}

// ----------------------------------------------------------------------------
// 6. Mentor Office Hours
// ----------------------------------------------------------------------------

export async function listMentorOfficeHours(
  mentorId?: string,
  cohortId?: string
): Promise<MentorOfficeHour[]> {
  try {
    let query = supabase
      .from('mentor_office_hours')
      .select('id, mentor_id, cohort_id, title, meeting_url, starts_at, duration_minutes, status, created_at')
      .order('starts_at', { ascending: true });

    if (mentorId) query = query.eq('mentor_id', mentorId);
    if (cohortId) query = query.eq('cohort_id', cohortId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const cohortIds = Array.from(new Set(data.map((d) => d.cohort_id).filter((c): c is string => Boolean(c))));
    const { data: cohorts } = cohortIds.length
      ? await supabase.from('cohorts').select('id, name').in('id', cohortIds)
      : { data: [] };
    const cohortMap = new Map((cohorts ?? []).map((c) => [c.id, c.name]));

    return data.map((d) => ({
      ...d,
      cohort_name: d.cohort_id ? cohortMap.get(d.cohort_id) || 'Cohort' : 'All Cohorts',
    }));
  } catch (err) {
    console.warn('Office hours table may not be migrated yet:', err);
    return [];
  }
}

export async function createMentorOfficeHour(data: {
  mentor_id: string;
  cohort_id?: string | null;
  title: string;
  meeting_url: string;
  starts_at: string;
  duration_minutes: number;
}): Promise<void> {
  const { error } = await supabase.from('mentor_office_hours').insert({
    mentor_id: data.mentor_id,
    cohort_id: data.cohort_id || null,
    title: data.title,
    meeting_url: data.meeting_url,
    starts_at: data.starts_at,
    duration_minutes: data.duration_minutes,
    status: 'available',
    created_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function deleteMentorOfficeHour(id: string): Promise<void> {
  const { error } = await supabase.from('mentor_office_hours').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------------------------------------------------------------
// 7. Direct Student Communications
// ----------------------------------------------------------------------------

export async function sendMentorMessage(
  recipientId: string,
  message: string,
  cohortId?: string,
  submissionId?: string
): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not authenticated');

  const { error } = await supabase.from('mentor_messages').insert({
    sender_id: authData.user.id,
    recipient_id: recipientId,
    cohort_id: cohortId || null,
    submission_id: submissionId || null,
    message: message.trim(),
    created_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function listConversationMessages(
  otherUserId: string,
  submissionId?: string
): Promise<MentorMessage[]> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return [];
    const myId = authData.user.id;

    let query = supabase
      .from('mentor_messages')
      .select('id, sender_id, recipient_id, cohort_id, submission_id, message, read_at, created_at')
      .or(`and(sender_id.eq.${myId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${myId})`)
      .order('created_at', { ascending: true });

    if (submissionId) {
      query = query.eq('submission_id', submissionId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as MentorMessage[];
  } catch (err) {
    console.warn('mentor_messages may not be migrated yet:', err);
    return [];
  }
}
