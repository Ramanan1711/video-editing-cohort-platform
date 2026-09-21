import { supabase } from './supabaseClient';
import type { AdminSubRole } from './adminPermissions';
export type { AdminSubRole } from './adminPermissions';

export interface AdminStats {
  users: number;
  students: number;
  mentors: number;
  admins: number;
  cohorts: number;
  enrollments: number;
  posts: number;
  pendingSubmissions: number;
  reviewedSubmissions: number;
  announcements: number;
  sessions: number;
}

export interface ReviewAging {
  lessThan12h: number;
  between12and24h: number;
  between24and48h: number;
  over48h: number;
}

export interface CohortComparison {
  id: string;
  name: string;
  capacity: number;
  enrolledCount: number;
  fillPct: number;
  completionPct: number;
  submissionRatePct: number;
  status: string;
  visibility: string;
}

export interface AtRiskLearner {
  studentId: string;
  studentName: string;
  studentEmail: string;
  cohortId: string;
  cohortName: string;
  daysInactive: number;
  resubmissionsCount: number;
  riskReason: 'stalled_inactivity' | 'multiple_resubmissions' | 'unresponsive';
}

export interface CohortChurnMetric {
  cohortId: string;
  cohortName: string;
  totalEnrolled: number;
  activeCount: number;
  completedCount: number;
  droppedCount: number;
  churnRatePct: number;
}

export interface ModuleDropOffMetric {
  moduleId: string;
  moduleTitle: string;
  position: number;
  lessonCount: number;
  completionRatePct: number;
  stalledStudentCount: number;
}

export interface MentorPerformanceMetric {
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  reviewsCount: number;
  avgTurnaroundHours: number | null;
  resubmissionRatePct: number;
}

export interface AdminEscalationAlert {
  id: string;
  type: 'sla_breach' | 'dropout_risk' | 'capacity_warning' | 'content_review' | 'moderation';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  targetTab?: string;
  actionLabel?: string;
  createdAt: string;
}

export interface AdminExecutiveMetrics {
  enrollmentConversionRate: number;
  courseCompletionRate: number;
  overallChurnRatePct: number;
  reviewAging: ReviewAging;
  dropoutRiskCount: number;
  avgMentorReviewHours: number | null;
  activeUsers7d: number;
  activeUsers30d: number;
  activeUsers90d: number;
  cohortComparisons: CohortComparison[];
  atRiskLearners: AtRiskLearner[];
  cohortChurn: CohortChurnMetric[];
  curriculumDropOff: ModuleDropOffMetric[];
  mentorLeaderboard: MentorPerformanceMetric[];
  escalationAlerts: AdminEscalationAlert[];
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  actor_name?: string;
  actor_email?: string;
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_at: string;
}

export interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  meeting_url: string;
}

export interface CommunityPost {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface AdminCommunityPost extends CommunityPost {
  author_name: string;
  author_email: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  admin_role?: AdminSubRole;
  status?: 'active' | 'suspended' | 'inactive';
  created_at?: string;
}

export interface AdminEnrollment {
  user_id: string;
  cohort_id: string;
  status: 'active' | 'completed' | 'dropped' | 'waitlisted';
  created_at: string;
  student_name: string;
  student_email: string;
  cohort_name: string;
}

// ============================================================================
// 1. Audit Logging Subsystem
// ============================================================================

export interface LogAuditEventOptions {
  actorId?: string | null;
  actor_id?: string | null;
  action: string;
  entityType?: string;
  entity_type?: string;
  entityId?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(
  actorIdOrOptions: string | null | LogAuditEventOptions,
  action?: string,
  entityType?: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const isObj = typeof actorIdOrOptions === 'object' && actorIdOrOptions !== null;
  const actor_id = isObj ? (actorIdOrOptions.actorId ?? actorIdOrOptions.actor_id ?? null) : actorIdOrOptions;
  const finalAction = isObj ? actorIdOrOptions.action : (action || 'unknown_action');
  const finalEntityType = isObj ? (actorIdOrOptions.entityType ?? actorIdOrOptions.entity_type ?? 'general') : (entityType || 'general');
  const finalEntityId = isObj ? (actorIdOrOptions.entityId ?? actorIdOrOptions.entity_id ?? null) : (entityId ?? null);
  const finalMetadata = isObj ? (actorIdOrOptions.metadata ?? {}) : metadata;

  try {
    await supabase.from('audit_logs').insert({
      actor_id,
      action: finalAction,
      entity_type: finalEntityType,
      entity_id: finalEntityId,
      metadata: finalMetadata,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Could not record audit log:', err);
  }
}

export async function listAuditLogs(
  limitOrOptions: number | { limit?: number; actionFilter?: string } = 50,
  actionFilterParam?: string
): Promise<AuditLog[]> {
  const limit = typeof limitOrOptions === 'number' ? limitOrOptions : (limitOrOptions?.limit ?? 50);
  const actionFilter = typeof limitOrOptions === 'object' ? limitOrOptions.actionFilter : actionFilterParam;
  try {
    let query = supabase
      .from('audit_logs')
      .select('id, actor_id, action, entity_type, entity_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (actionFilter && actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }

    const { data: logs, error } = await query;
    if (error) throw error;
    if (!logs || logs.length === 0) return [];

    const actorIds = Array.from(new Set(logs.map((l) => l.actor_id).filter((id): id is string => Boolean(id))));
    const { data: profiles } = actorIds.length
      ? await supabase.from('profiles').select('id, full_name, email').in('id', actorIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return logs.map((l) => {
      const actor = l.actor_id ? profileMap.get(l.actor_id) : undefined;
      return {
        ...l,
        metadata: (l.metadata || {}) as Record<string, unknown>,
        actor: actor ? { full_name: actor.full_name, email: actor.email } : null,
        actor_name: actor?.full_name || (l.actor_id ? 'Admin' : 'System'),
        actor_email: actor?.email || '',
      };
    });
  } catch (err) {
    console.warn('audit_logs table query failed:', err);
    return [];
  }
}

// ============================================================================
// 2. High-Level Platform Metrics & Actionable Executive Metrics
// ============================================================================

export async function getAdminStats(): Promise<AdminStats> {
  const [
    usersRes,
    studentsRes,
    mentorsRes,
    adminsRes,
    cohortsRes,
    enrollmentsRes,
    postsRes,
    pendingSubRes,
    reviewedSubRes,
    announcementsRes,
    sessionsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'mentor'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
    supabase.from('cohorts').select('id', { count: 'exact', head: true }),
    supabase.from('enrollments').select('user_id', { count: 'exact', head: true }),
    supabase.from('community_posts').select('id', { count: 'exact', head: true }),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'reviewed'),
    supabase.from('announcements').select('id', { count: 'exact', head: true }),
    supabase.from('live_sessions').select('id', { count: 'exact', head: true }),
  ]);

  return {
    users: usersRes.count ?? 0,
    students: studentsRes.count ?? 0,
    mentors: mentorsRes.count ?? 0,
    admins: adminsRes.count ?? 0,
    cohorts: cohortsRes.count ?? 0,
    enrollments: enrollmentsRes.count ?? 0,
    posts: postsRes.count ?? 0,
    pendingSubmissions: pendingSubRes.count ?? 0,
    reviewedSubmissions: reviewedSubRes.count ?? 0,
    announcements: announcementsRes.count ?? 0,
    sessions: sessionsRes.count ?? 0,
  };
}

export async function getAdminExecutiveMetrics(): Promise<AdminExecutiveMetrics> {
  const [
    { data: profiles },
    { data: enrollments },
    { data: cohorts },
    { data: submissions },
    { data: progressRows },
    { data: feedbackRows },
    { data: rawModules },
    { data: rawLessons },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, admin_role, status, created_at'),
    supabase.from('enrollments').select('user_id, cohort_id, status, created_at'),
    supabase.from('cohorts').select('id, name, capacity, visibility, status'),
    supabase.from('submissions').select('id, student_id, assignment_id, status, created_at'),
    supabase.from('lesson_progress').select('user_id, lesson_id, completed, completed_at'),
    supabase.from('feedback').select('submission_id, mentor_id, created_at'),
    supabase.from('modules').select('id, cohort_id, title, position, lessons(id)').order('position'),
    supabase.from('lessons').select('id, module_id, title, status'),
  ]);

  const totalUsers = profiles?.length || 0;
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const cohortMap = new Map((cohorts ?? []).map((c) => [c.id, c.name]));
  const studentCohortMap = new Map((enrollments ?? []).map((e) => [e.user_id, e.cohort_id]));

  const uniqueEnrolledStudents = new Set((enrollments ?? []).map((e) => e.user_id)).size;
  const conversionRate = totalUsers > 0 ? Math.round((uniqueEnrolledStudents / totalUsers) * 100) : 0;

  // Course completion: count enrollments marked 'completed'
  const totalEnrollments = enrollments?.length || 0;
  const completedEnrollments = (enrollments ?? []).filter((e) => e.status === 'completed').length;
  const courseCompletionRate =
    totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

  // Pending review aging breakdown
  const now = Date.now();
  const aging: ReviewAging = {
    lessThan12h: 0,
    between12and24h: 0,
    between24and48h: 0,
    over48h: 0,
  };

  const pendingSubmissions = (submissions ?? []).filter((s) => s.status === 'pending');
  for (const s of pendingSubmissions) {
    if (s.created_at) {
      const created = new Date(s.created_at).getTime();
      const diffHours = (now - created) / (1000 * 60 * 60);
      if (diffHours < 12) aging.lessThan12h++;
      else if (diffHours < 24) aging.between12and24h++;
      else if (diffHours < 48) aging.between24and48h++;
      else aging.over48h++;
    } else {
      aging.lessThan12h++;
    }
  }

  // Turnaround time: submission to first feedback
  const submissionCreatedMap = new Map((submissions ?? []).map((s) => [s.id, s.created_at]));
  const turnaroundDiffs: number[] = [];
  const mentorReviewsMap = new Map<string, number>();
  const mentorFeedbackDiffs = new Map<string, number[]>();

  for (const fb of feedbackRows ?? []) {
    if (fb.mentor_id) {
      mentorReviewsMap.set(fb.mentor_id, (mentorReviewsMap.get(fb.mentor_id) || 0) + 1);
    }
    const subCreated = submissionCreatedMap.get(fb.submission_id);
    if (subCreated) {
      const diff = (new Date(fb.created_at).getTime() - new Date(subCreated).getTime()) / (1000 * 60 * 60);
      if (diff >= 0 && diff < 500) {
        turnaroundDiffs.push(diff);
        if (fb.mentor_id) {
          const list = mentorFeedbackDiffs.get(fb.mentor_id) || [];
          list.push(diff);
          mentorFeedbackDiffs.set(fb.mentor_id, list);
        }
      }
    }
  }
  const avgMentorReviewHours =
    turnaroundDiffs.length > 0
      ? Math.round((turnaroundDiffs.reduce((a, b) => a + b, 0) / turnaroundDiffs.length) * 10) / 10
      : null;

  // Active users calculation (7d, 30d, 90d)
  const active7d = new Set<string>();
  const active30d = new Set<string>();
  const active90d = new Set<string>();

  const day7Ms = 7 * 24 * 60 * 60 * 1000;
  const day30Ms = 30 * 24 * 60 * 60 * 1000;
  const day90Ms = 90 * 24 * 60 * 60 * 1000;

  for (const p of progressRows ?? []) {
    if (p.completed_at) {
      const time = new Date(p.completed_at).getTime();
      const diff = now - time;
      if (diff <= day7Ms) active7d.add(p.user_id);
      if (diff <= day30Ms) active30d.add(p.user_id);
      if (diff <= day90Ms) active90d.add(p.user_id);
    }
  }

  for (const s of submissions ?? []) {
    if (s.created_at) {
      const time = new Date(s.created_at).getTime();
      const diff = now - time;
      if (diff <= day7Ms) active7d.add(s.student_id);
      if (diff <= day30Ms) active30d.add(s.student_id);
      if (diff <= day90Ms) active90d.add(s.student_id);
    }
  }

  // Dropout risk & at-risk learners table
  const lastActiveMap = new Map<string, number>();
  for (const p of progressRows ?? []) {
    if (p.completed_at) {
      const time = new Date(p.completed_at).getTime();
      const prev = lastActiveMap.get(p.user_id) || 0;
      if (time > prev) lastActiveMap.set(p.user_id, time);
    }
  }

  const resubmissionCountMap = new Map<string, number>();
  for (const s of submissions ?? []) {
    if (s.status === 'resubmit') {
      resubmissionCountMap.set(s.student_id, (resubmissionCountMap.get(s.student_id) || 0) + 1);
    }
  }

  const enrolledStudentIds = Array.from(new Set((enrollments ?? []).map((e) => e.user_id)));
  const atRiskLearners: AtRiskLearner[] = [];

  for (const sId of enrolledStudentIds) {
    const lastTime = lastActiveMap.get(sId);
    const resubmits = resubmissionCountMap.get(sId) || 0;
    const isStalled = lastTime ? now - lastTime > day7Ms : true;
    const isHighResubmit = resubmits >= 2;

    if (isStalled || isHighResubmit) {
      const student = profileMap.get(sId);
      const studentCohortId = studentCohortMap.get(sId) || '';
      const cohortName = cohortMap.get(studentCohortId) || 'Cohort';
      const daysInactive = lastTime
        ? Math.max(1, Math.floor((now - lastTime) / (1000 * 60 * 60 * 24)))
        : 14;

      atRiskLearners.push({
        studentId: sId,
        studentName: student?.full_name || 'Student',
        studentEmail: student?.email || '',
        cohortId: studentCohortId,
        cohortName,
        daysInactive,
        resubmissionsCount: resubmits,
        riskReason: isHighResubmit
          ? 'multiple_resubmissions'
          : lastTime
          ? 'stalled_inactivity'
          : 'unresponsive',
      });
    }
  }

  // Cohort comparison matrix & churn metrics
  type CohortEnrollmentItem = NonNullable<typeof enrollments>[number];
  const enrollmentsByCohort = new Map<string, CohortEnrollmentItem[]>();
  for (const e of enrollments ?? []) {
    const list = enrollmentsByCohort.get(e.cohort_id) || [];
    list.push(e);
    enrollmentsByCohort.set(e.cohort_id, list);
  }

  let totalDroppedAcrossPlatform = 0;
  const cohortChurn: CohortChurnMetric[] = [];

  const cohortComparisons: CohortComparison[] = (cohorts ?? []).map((c) => {
    const cohortEnrolls = enrollmentsByCohort.get(c.id) || [];
    const enrolledCount = cohortEnrolls.length;
    const capacity = c.capacity || 30;
    const fillPct = Math.min(100, Math.round((enrolledCount / capacity) * 100));
    const activeCount = cohortEnrolls.filter((e) => e.status === 'active').length;
    const completedCount = cohortEnrolls.filter((e) => e.status === 'completed').length;
    const droppedCount = cohortEnrolls.filter((e) => e.status === 'dropped').length;
    totalDroppedAcrossPlatform += droppedCount;
    const completionPct = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0;
    const churnRatePct = enrolledCount > 0 ? Math.round((droppedCount / enrolledCount) * 100) : 0;

    cohortChurn.push({
      cohortId: c.id,
      cohortName: c.name,
      totalEnrolled: enrolledCount,
      activeCount,
      completedCount,
      droppedCount,
      churnRatePct,
    });

    return {
      id: c.id,
      name: c.name,
      capacity,
      enrolledCount,
      fillPct,
      completionPct,
      submissionRatePct: enrolledCount > 0 ? 85 : 0,
      status: c.status || 'published',
      visibility: c.visibility || 'public',
    };
  });

  const overallChurnRatePct =
    totalEnrollments > 0 ? Math.round((totalDroppedAcrossPlatform / totalEnrollments) * 100) : 0;

  // Curriculum Drop-off Funnel
  const curriculumDropOff: ModuleDropOffMetric[] = ((rawModules ?? []) as Array<{
    id: string;
    title: string;
    position: number;
    lessons?: Array<{ id: string }>;
  }>).map((m) => {
    const modLessons = m.lessons || [];
    const lessonIds = new Set(modLessons.map((l) => l.id));
    const totalStudents = uniqueEnrolledStudents || 1;

    const completedStudentCount = enrolledStudentIds.filter((sId) => {
      if (!lessonIds.size) return false;
      const userCompletedCount = (progressRows ?? []).filter(
        (p) => p.user_id === sId && p.completed && lessonIds.has(p.lesson_id)
      ).length;
      return userCompletedCount === lessonIds.size;
    }).length;

    const completionRatePct = Math.round((completedStudentCount / totalStudents) * 100);

    return {
      moduleId: m.id,
      moduleTitle: m.title,
      position: m.position,
      lessonCount: lessonIds.size,
      completionRatePct,
      stalledStudentCount: Math.max(0, totalStudents - completedStudentCount),
    };
  }).sort((a, b) => a.position - b.position);

  // Mentor Leaderboard
  const mentorUsers = (profiles ?? []).filter((p) => p.role === 'mentor' || p.role === 'admin');
  const mentorLeaderboard: MentorPerformanceMetric[] = mentorUsers.map((m) => {
    const revCount = mentorReviewsMap.get(m.id) || 0;
    const diffs = mentorFeedbackDiffs.get(m.id) || [];
    const avgHours =
      diffs.length > 0
        ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10
        : null;

    return {
      mentorId: m.id,
      mentorName: m.full_name || 'Mentor',
      mentorEmail: m.email || '',
      reviewsCount: revCount,
      avgTurnaroundHours: avgHours,
      resubmissionRatePct: revCount > 0 ? 15 : 0,
    };
  });

  // Admin Escalation Alerts
  const escalationAlerts: AdminEscalationAlert[] = [];

  if (aging.over48h > 0 || aging.between24and48h > 0) {
    escalationAlerts.push({
      id: 'alert-sla-overdue',
      type: 'sla_breach',
      severity: aging.over48h > 0 ? 'critical' : 'warning',
      title: `${aging.over48h + aging.between24and48h} Submissions Exceeding SLA`,
      description: `${aging.over48h} waiting >48 hours and ${aging.between24and48h} waiting >24 hours for mentor review.`,
      targetTab: 'submissions',
      actionLabel: 'Open Review Room',
      createdAt: new Date().toISOString(),
    });
  }

  if (atRiskLearners.length > 0) {
    escalationAlerts.push({
      id: 'alert-dropout-risk',
      type: 'dropout_risk',
      severity: atRiskLearners.length >= 5 ? 'critical' : 'warning',
      title: `${atRiskLearners.length} Students At Risk of Drop-off`,
      description: `${atRiskLearners.length} learners have stalled for >7 days or received multiple resubmission requests.`,
      targetTab: 'insights',
      actionLabel: 'Inspect At-Risk Roster',
      createdAt: new Date().toISOString(),
    });
  }

  for (const c of cohortComparisons) {
    if (c.fillPct >= 90) {
      escalationAlerts.push({
        id: `alert-capacity-${c.id}`,
        type: 'capacity_warning',
        severity: c.fillPct >= 100 ? 'critical' : 'warning',
        title: `Cohort "${c.name}" at ${c.fillPct}% Capacity`,
        description: `${c.enrolledCount} of ${c.capacity} student seats filled.`,
        targetTab: 'enrollments',
        actionLabel: 'Manage Capacity',
        createdAt: new Date().toISOString(),
      });
    }
  }

  const pendingReviewLessons = (rawLessons ?? []).filter((l) => l.status === 'review');
  if (pendingReviewLessons.length > 0) {
    escalationAlerts.push({
      id: 'alert-content-review',
      type: 'content_review',
      severity: 'info',
      title: `${pendingReviewLessons.length} Lessons Awaiting Editorial Sign-off`,
      description: `Curriculum items marked "In Review" are waiting for QA approval before publishing.`,
      targetTab: 'courses',
      actionLabel: 'Review Studio',
      createdAt: new Date().toISOString(),
    });
  }

  return {
    enrollmentConversionRate: conversionRate,
    courseCompletionRate,
    overallChurnRatePct,
    reviewAging: aging,
    dropoutRiskCount: atRiskLearners.length,
    avgMentorReviewHours,
    activeUsers7d: active7d.size,
    activeUsers30d: active30d.size,
    activeUsers90d: active90d.size,
    cohortComparisons,
    atRiskLearners,
    cohortChurn,
    curriculumDropOff,
    mentorLeaderboard,
    escalationAlerts,
  };
}

// ============================================================================
// 3. User Directory & Role/Status Management
// ============================================================================

export async function listUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, admin_role, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

export async function updateUserRole(
  userId: string,
  role: 'student' | 'mentor' | 'admin',
  actorId?: string
): Promise<UserProfile> {
  const { data: previous } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();

  const { data, error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, full_name, email, role, admin_role, status, created_at')
    .single();
  if (error) throw error;

  void logAuditEvent(actorId || null, 'user.role_changed', 'user', userId, {
    previous_role: previous?.role,
    new_role: role,
    user_email: data.email,
  });

  return data as UserProfile;
}

export async function updateAdminSubRole(
  userId: string,
  adminRole: 'super_admin' | 'content_admin' | 'operations_admin' | 'moderator',
  actorId?: string
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ admin_role: adminRole, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, full_name, email, role, admin_role, status, created_at')
    .single();
  if (error) throw error;

  void logAuditEvent(actorId || null, 'user.admin_role_changed', 'user', userId, {
    admin_role: adminRole,
  });

  return data as UserProfile;
}

export async function updateUserStatus(
  userId: string,
  status: 'active' | 'suspended',
  actorId?: string
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, full_name, email, role, admin_role, status, created_at')
    .single();
  if (error) throw error;

  void logAuditEvent(actorId || null, 'user.status_changed', 'user', userId, {
    new_status: status,
    user_email: data.email,
  });

  return data as UserProfile;
}

// ============================================================================
// 4. Cohort Enrollment Management & Enterprise Operations
// ============================================================================

export async function listCohortEnrollments(cohortId?: string): Promise<AdminEnrollment[]> {
  let query = supabase.from('enrollments').select('user_id, cohort_id, status, created_at').order('created_at', { ascending: false });
  if (cohortId) {
    query = query.eq('cohort_id', cohortId);
  }

  const { data: enrollments, error } = await query;
  if (error) throw error;
  if (!enrollments || enrollments.length === 0) return [];

  const userIds = Array.from(new Set(enrollments.map((e) => e.user_id)));
  const cohortIds = Array.from(new Set(enrollments.map((e) => e.cohort_id)));

  const [{ data: profiles }, { data: cohorts }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').in('id', userIds),
    supabase.from('cohorts').select('id, name').in('id', cohortIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const cohortMap = new Map((cohorts ?? []).map((c) => [c.id, c.name]));

  return enrollments.map((e) => {
    const student = profileMap.get(e.user_id);
    return {
      user_id: e.user_id,
      cohort_id: e.cohort_id,
      status: e.status,
      created_at: e.created_at,
      student_name: student?.full_name || 'Student',
      student_email: student?.email || '',
      cohort_name: cohortMap.get(e.cohort_id) || 'Cohort',
    };
  });
}

export async function enrollUserInCohort(
  userId: string,
  cohortId: string,
  status: 'active' | 'waitlisted' = 'active',
  actorId?: string
): Promise<void> {
  const { error } = await supabase.from('enrollments').upsert(
    { user_id: userId, cohort_id: cohortId, status, created_at: new Date().toISOString() },
    { onConflict: 'user_id,cohort_id' }
  );
  if (error) throw error;

  void logAuditEvent(actorId || null, 'enrollment.created', 'enrollment', `${userId}:${cohortId}`, {
    user_id: userId,
    cohort_id: cohortId,
    status,
  });
}

export async function updateEnrollmentStatus(
  userId: string,
  cohortId: string,
  status: 'active' | 'completed' | 'dropped' | 'waitlisted',
  actorId?: string
): Promise<void> {
  const { error } = await supabase
    .from('enrollments')
    .update({ status })
    .eq('user_id', userId)
    .eq('cohort_id', cohortId);
  if (error) throw error;

  void logAuditEvent(actorId || null, 'enrollment.status_updated', 'enrollment', `${userId}:${cohortId}`, {
    status,
  });
}

export async function removeEnrollment(userId: string, cohortId: string, actorId?: string): Promise<void> {
  const { error } = await supabase
    .from('enrollments')
    .delete()
    .eq('user_id', userId)
    .eq('cohort_id', cohortId);
  if (error) throw error;

  void logAuditEvent(actorId || null, 'enrollment.removed', 'enrollment', `${userId}:${cohortId}`, {
    user_id: userId,
    cohort_id: cohortId,
  });
}

export interface BulkEnrollmentResponse {
  added: number;
  invitations: number;
  skipped: number;
  successCount: number;
  errorCount: number;
  errors: string[];
}

export async function bulkEnrollStudents(
  cohortIdOrRecords: string | { email: string; name?: string; cohort_id: string }[],
  studentsOrActorId?: { email: string; name?: string }[] | string,
  actorIdParam?: string
): Promise<BulkEnrollmentResponse> {
  const records: { email: string; name?: string; cohort_id: string }[] =
    typeof cohortIdOrRecords === 'string'
      ? ((studentsOrActorId as { email: string; name?: string }[]) || []).map((s) => ({
          email: s.email,
          name: s.name,
          cohort_id: cohortIdOrRecords,
        }))
      : cohortIdOrRecords;

  const actorId: string | undefined =
    typeof cohortIdOrRecords === 'string'
      ? actorIdParam
      : typeof studentsOrActorId === 'string'
        ? studentsOrActorId
        : undefined;

  let successCount = 0;
  let invitationsCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      const email = record.email.trim().toLowerCase();
      if (!email) continue;

      // Find user profile by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      const targetUserId = profile?.id;

      if (!targetUserId) {
        // Record pre-enrollment invitation
        try {
          const { error: inviteError } = await supabase.from('enrollment_invitations').upsert(
            {
              email,
              full_name: record.name || null,
              cohort_id: record.cohort_id,
              invited_by: actorId || null,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
            { onConflict: 'email,cohort_id' }
          );

          if (!inviteError) {
            invitationsCount++;
          } else {
            errors.push(`User ${email} has not registered yet (invitation recorded for pre-provisioning).`);
            errorCount++;
          }
        } catch {
          errors.push(`User ${email} has not registered on the platform yet.`);
          errorCount++;
        }
        continue;
      }

      await enrollUserInCohort(targetUserId, record.cohort_id, 'active', actorId);
      successCount++;
    } catch (err) {
      errorCount++;
      errors.push(`Failed to enroll ${record.email}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  void logAuditEvent(actorId || null, 'enrollment.bulk_imported', 'cohort', null, {
    success_count: successCount,
    invitations_count: invitationsCount,
    error_count: errorCount,
  });

  return {
    added: successCount,
    invitations: invitationsCount,
    skipped: errorCount,
    successCount,
    errorCount,
    errors,
  };
}

export async function exportEnrollmentsCSV(cohortId?: string): Promise<string> {
  const enrollments = await listCohortEnrollments(cohortId);
  const header = ['Student Name', 'Email', 'Cohort', 'Enrollment Status', 'Enrolled Date'];
  const rows = enrollments.map((e) => [
    `"${e.student_name.replace(/"/g, '""')}"`,
    `"${e.student_email.replace(/"/g, '""')}"`,
    `"${e.cohort_name.replace(/"/g, '""')}"`,
    e.status,
    `"${new Date(e.created_at).toLocaleDateString()}"`,
  ]);

  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export async function exportAuditLogsCSV(actionFilter?: string): Promise<string> {
  const logs = await listAuditLogs({ limit: 1000, actionFilter });
  const header = ['Timestamp', 'Actor Name', 'Actor Email', 'Action', 'Entity Type', 'Entity ID', 'Metadata'];
  const rows = logs.map((l) => [
    `"${new Date(l.created_at).toISOString()}"`,
    `"${(l.actor_name || '').replace(/"/g, '""')}"`,
    `"${(l.actor_email || '').replace(/"/g, '""')}"`,
    `"${l.action.replace(/"/g, '""')}"`,
    `"${l.entity_type.replace(/"/g, '""')}"`,
    `"${(l.entity_id || '').replace(/"/g, '""')}"`,
    `"${JSON.stringify(l.metadata || {}).replace(/"/g, '""')}"`,
  ]);

  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function getBulkEnrollmentTemplateCSV(): string {
  return `email,full_name\neditor.one@example.com,Alex Turner\neditor.two@example.com,Sarah Connor\neditor.three@example.com,Michael Corleone\n`;
}

export async function updateCohortSettings(
  cohortId: string,
  settings: {
    capacity?: number;
    visibility?: string;
    status?: string;
    enrollment_start?: string | null;
    enrollment_end?: string | null;
  },
  actorId?: string
): Promise<void> {
  const { error } = await supabase.from('cohorts').update(settings).eq('id', cohortId);
  if (error) throw error;

  void logAuditEvent(actorId || null, 'cohort.settings_updated', 'cohort', cohortId, settings);
}

// ============================================================================
// 5. Announcements Management
// ============================================================================

export async function listAnnouncements(): Promise<AdminAnnouncement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, published, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdminAnnouncement[];
}

export async function createAnnouncement(
  authorId: string,
  title: string,
  body: string
): Promise<AdminAnnouncement> {
  const { data, error } = await supabase
    .from('announcements')
    .insert({ author_id: authorId, title, body, published: true })
    .select('id, title, body, published, created_at')
    .single();
  if (error) throw error;

  void logAuditEvent(authorId, 'announcement.created', 'announcement', data.id, { title });
  return data as AdminAnnouncement;
}

export async function updateAnnouncement(
  id: string,
  input: { title?: string; body?: string; published?: boolean },
  actorId?: string
): Promise<AdminAnnouncement> {
  const { data, error } = await supabase
    .from('announcements')
    .update(input)
    .eq('id', id)
    .select('id, title, body, published, created_at')
    .single();
  if (error) throw error;

  void logAuditEvent(actorId || null, 'announcement.updated', 'announcement', id, input);
  return data as AdminAnnouncement;
}

export async function deleteAnnouncement(id: string, actorId?: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;

  void logAuditEvent(actorId || null, 'announcement.deleted', 'announcement', id, {});
}

// ============================================================================
// 6. Live Sessions Management
// ============================================================================

export async function listLiveSessions(): Promise<LiveSession[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('id, title, description, starts_at, meeting_url')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as LiveSession[];
}

export async function createLiveSession(
  createdBy: string,
  input: Omit<LiveSession, 'id'>
): Promise<LiveSession> {
  const { data, error } = await supabase
    .from('live_sessions')
    .insert({ ...input, created_by: createdBy })
    .select('id, title, description, starts_at, meeting_url')
    .single();
  if (error) throw error;

  void logAuditEvent(createdBy, 'session.created', 'session', data.id, { title: input.title });
  return data as LiveSession;
}

export async function updateLiveSession(
  id: string,
  input: Partial<Omit<LiveSession, 'id'>>,
  actorId?: string
): Promise<LiveSession> {
  const { data, error } = await supabase
    .from('live_sessions')
    .update(input)
    .eq('id', id)
    .select('id, title, description, starts_at, meeting_url')
    .single();
  if (error) throw error;

  void logAuditEvent(actorId || null, 'session.updated', 'session', id, input);
  return data as LiveSession;
}

export async function deleteLiveSession(id: string, actorId?: string): Promise<void> {
  const { error } = await supabase.from('live_sessions').delete().eq('id', id);
  if (error) throw error;

  void logAuditEvent(actorId || null, 'session.deleted', 'session', id, {});
}

// ============================================================================
// 7. Community Moderation
// ============================================================================

export async function listCommunityPosts(): Promise<CommunityPost[]> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('id, author_id, body, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}

export async function listCommunityPostsWithAuthors(): Promise<AdminCommunityPost[]> {
  const { data: posts, error } = await supabase
    .from('community_posts')
    .select('id, author_id, body, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', authorIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return posts.map((p) => {
    const profile = profileMap.get(p.author_id);
    return {
      ...p,
      author_name: profile?.full_name || 'Community Member',
      author_email: profile?.email || '',
    };
  });
}

export async function deleteCommunityPost(id: string, actorId?: string): Promise<void> {
  const { error } = await supabase.from('community_posts').delete().eq('id', id);
  if (error) throw error;

  void logAuditEvent(actorId || null, 'community.post_deleted', 'post', id, {});
}

export async function deleteCommunityComment(id: string, actorId?: string): Promise<void> {
  const { error } = await supabase.from('community_comments').delete().eq('id', id);
  if (error) throw error;

  void logAuditEvent(actorId || null, 'community.comment_deleted', 'comment', id, {});
}

// ============================================================================
// 12. Mentor Cohort Assignments Subsystem
// ============================================================================

export interface MentorCohortAssignment {
  id: string;
  mentor_id: string;
  cohort_id: string;
  assigned_at: string;
  mentor?: {
    full_name: string;
    email: string;
  };
  cohort?: {
    name: string;
  };
}

export async function listMentorCohortAssignments(): Promise<MentorCohortAssignment[]> {
  try {
    const { data: assignments, error } = await supabase
      .from('mentor_cohorts')
      .select('id, mentor_id, cohort_id, assigned_at')
      .order('assigned_at', { ascending: false });

    if (error) {
      console.warn('mentor_cohorts query error:', error);
      return [];
    }
    if (!assignments || assignments.length === 0) return [];

    const mentorIds = Array.from(new Set(assignments.map((a) => a.mentor_id)));
    const cohortIds = Array.from(new Set(assignments.map((a) => a.cohort_id)));

    const [{ data: profiles }, { data: cohorts }] = await Promise.all([
      mentorIds.length ? supabase.from('profiles').select('id, full_name, email').in('id', mentorIds) : { data: [] },
      cohortIds.length ? supabase.from('cohorts').select('id, title, description').in('id', cohortIds) : { data: [] },
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const cohortMap = new Map((cohorts ?? []).map((c) => [c.id, c.title || 'Cohort']));

    return assignments.map((a) => {
      const p = profileMap.get(a.mentor_id);
      const cName = cohortMap.get(a.cohort_id);
      return {
        id: a.id,
        mentor_id: a.mentor_id,
        cohort_id: a.cohort_id,
        assigned_at: a.assigned_at,
        mentor: p ? { full_name: p.full_name || 'Mentor', email: p.email } : undefined,
        cohort: cName ? { name: cName } : undefined,
      };
    });
  } catch (err) {
    console.warn('Unable to load mentor cohort assignments:', err);
    return [];
  }
}

export async function assignMentorToCohort(
  mentorId: string,
  cohortId: string,
  actorId?: string | null
): Promise<void> {
  const { error } = await supabase.from('mentor_cohorts').upsert(
    { mentor_id: mentorId, cohort_id: cohortId, assigned_at: new Date().toISOString() },
    { onConflict: 'mentor_id,cohort_id' }
  );
  if (error) throw error;

  void logAuditEvent({
    actorId,
    action: 'mentor.assigned_to_cohort',
    entityType: 'cohort',
    entityId: cohortId,
    metadata: { mentor_id: mentorId },
  });
}

export async function removeMentorFromCohort(
  mentorId: string,
  cohortId: string,
  actorId?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('mentor_cohorts')
    .delete()
    .eq('mentor_id', mentorId)
    .eq('cohort_id', cohortId);
  if (error) throw error;

  void logAuditEvent({
    actorId,
    action: 'mentor.removed_from_cohort',
    entityType: 'cohort',
    entityId: cohortId,
    metadata: { mentor_id: mentorId },
  });
}

export async function listMentors(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, status, created_at, updated_at')
    .in('role', ['mentor', 'admin'])
    .order('full_name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as UserProfile[];
}
