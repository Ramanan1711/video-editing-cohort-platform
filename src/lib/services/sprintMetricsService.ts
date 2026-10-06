import { supabase } from '../supabaseClient';
import { parseDatabaseError } from '../errorHandling';
import { getStudentCourseData } from './lessonProgressService';
import { listAssignments, listMySubmissions } from './assignmentSubmissionService';
import { getStudentSprintDays } from '../internshipService';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  type: 'assignment' | 'live_session' | 'reminder';
  date: string;
  status?: string;
  actionUrl?: string;
  isCompleted?: boolean;
  reminderType?: 'study_block' | 'assignment_prep' | 'review_session' | 'custom';
}

export interface StudentNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  category?: 'review' | 'community' | 'deadline' | 'system';
  action_url?: string | null;
}

export interface StudentAnnouncement {
  id: string;
  cohort_id?: string | null;
  title: string;
  body: string;
  created_at: string;
}

export interface StudentLiveSession {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  meeting_url: string;
}

export interface StudentStudyReminder {
  id: string;
  user_id: string;
  cohort_id?: string | null;
  title: string;
  description?: string | null;
  scheduled_at: string;
  reminder_type: 'study_block' | 'assignment_prep' | 'review_session' | 'custom';
  is_completed: boolean;
  created_at?: string;
}

export interface StudentUnifiedProgress {
  student_id: string;
  cohort_id: string;
  enrollment: {
    is_enrolled: boolean;
    status: string;
  };
  curriculum: {
    total_lessons: number;
    completed_lessons: number;
    percent: number;
    total_watch_seconds: number;
  };
  assignments: {
    total_assignments: number;
    submitted_assignments: number;
    approved_assignments: number;
    percent: number;
  };
  sprint_challenges: {
    configured_sprint_days: number;
    effective_sprint_days: number;
    total_challenges: number;
    submitted_challenges: number;
    completed_challenges: number;
    percent: number;
    streak_days: number;
    average_score: number | null;
  };
  attendance?: {
    total_sessions: number;
    attended_sessions: number;
    attendance_rate_pct: number;
    min_attendance_pct: number;
    is_passed: boolean;
  };
  overall: {
    composite_percent: number;
    total_milestones: number;
    completed_milestones: number;
    is_completed: boolean;
    eligible_for_certificate: boolean;
    has_certificate: boolean;
    certificate_number?: string | null;
    certificate_issued_at?: string | null;
  };
}

// Student Announcements
export async function listStudentAnnouncements(cohortId?: string | null): Promise<StudentAnnouncement[]> {
  let query = supabase
    .from('announcements')
    .select('id, cohort_id, title, body, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false });

  if (cohortId) {
    // When a cohort is selected, retrieve announcements targeted to that cohort or platform broadcasts (cohort_id is null)
    query = query.or(`cohort_id.is.null,cohort_id.eq.${cohortId}`);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === '42703' || error.message.includes('cohort_id')) {
      const fb = await supabase
        .from('announcements')
        .select('id, title, body, created_at')
        .eq('published', true)
        .order('created_at', { ascending: false });
      if (!fb.error && fb.data) {
        return fb.data as StudentAnnouncement[];
      }
    }
    if (error.code === '42P01' || error.message.includes('announcements')) {
      console.warn('Announcements table not yet migrated, returning empty list');
      return [];
    }
    throw parseDatabaseError(error);
  }
  return (data ?? []) as StudentAnnouncement[];
}

// Student Live Sessions
export async function listStudentLiveSessions(): Promise<StudentLiveSession[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('id, title, description, starts_at, meeting_url')
    .order('starts_at', { ascending: true });

  if (error) {
    if (error.code === '42P01' || error.message.includes('live_sessions')) {
      console.warn('Live sessions table not yet migrated, returning empty list');
      return [];
    }
    throw parseDatabaseError(error);
  }
  return (data ?? []) as StudentLiveSession[];
}

// Student Notifications
export async function listStudentNotifications(userId: string): Promise<StudentNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, body, read_at, created_at, category, action_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error && (error.message.includes('category') || error.message.includes('action_url'))) {
    const { data: legacy, error: legacyError } = await supabase
      .from('notifications')
      .select('id, user_id, title, body, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (legacyError) {
      if (legacyError.code === '42P01' || legacyError.message.includes('notifications')) return [];
      throw parseDatabaseError(legacyError);
    }
    return (legacy ?? []).map((n) => {
      let cat: 'review' | 'community' | 'deadline' | 'system' = 'system';
      const text = `${n.title} ${n.body}`.toLowerCase();
      if (text.includes('review') || text.includes('feedback') || text.includes('critique') || text.includes('grade')) cat = 'review';
      else if (text.includes('comment') || text.includes('post') || text.includes('reply') || text.includes('mention')) cat = 'community';
      else if (text.includes('deadline') || text.includes('due') || text.includes('assignment')) cat = 'deadline';
      return { ...n, category: cat };
    });
  }

  if (error) {
    if (error.code === '42P01' || error.message.includes('notifications')) {
      console.warn('Notifications table not yet migrated, returning empty list');
      return [];
    }
    throw parseDatabaseError(error);
  }
  return (data ?? []) as StudentNotification[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

// Student Study Planning Reminders (Database-Backed with Offline Fallback)
export async function listStudentStudyReminders(
  userId: string,
  cohortId?: string
): Promise<StudentStudyReminder[]> {
  try {
    let query = supabase
      .from('student_study_reminders')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true });

    if (cohortId) {
      query = query.or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Failed to load student study reminders:', error.message);
      return [];
    }
    return (data ?? []) as StudentStudyReminder[];
  } catch (err) {
    console.warn('student_study_reminders query error:', err);
    return [];
  }
}

export async function createStudentStudyReminder(
  input: Omit<StudentStudyReminder, 'id' | 'created_at'>
): Promise<StudentStudyReminder> {
  const { data, error } = await supabase
    .from('student_study_reminders')
    .insert({
      user_id: input.user_id,
      cohort_id: input.cohort_id || null,
      title: input.title,
      description: input.description || null,
      scheduled_at: input.scheduled_at,
      reminder_type: input.reminder_type || 'study_block',
      is_completed: input.is_completed || false,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw parseDatabaseError(error);
  }

  return data as StudentStudyReminder;
}

export async function toggleStudyReminder(
  id: string,
  isCompleted: boolean,
  _userId: string
): Promise<void> {
  const { error } = await supabase
    .from('student_study_reminders')
    .update({ is_completed: isCompleted })
    .eq('id', id);

  if (error) {
    throw parseDatabaseError(error);
  }
}

export async function deleteStudentStudyReminder(
  id: string,
  _userId: string
): Promise<void> {
  const { error } = await supabase
    .from('student_study_reminders')
    .delete()
    .eq('id', id);

  if (error) {
    throw parseDatabaseError(error);
  }
}

// Student Consolidated Calendar
export async function listStudentCalendarEvents(
  studentId: string,
  cohortId?: string
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];

  try {
    const [assignments, liveSessions, submissions] = await Promise.all([
      cohortId ? listAssignments(cohortId) : Promise.resolve([]),
      listStudentLiveSessions(),
      listMySubmissions(studentId),
    ]);

    const submissionMap = new Map(submissions.map((s) => [s.assignment_id, s]));

    for (const a of assignments) {
      if (a.deadline) {
        const sub = submissionMap.get(a.id);
        events.push({
          id: `assignment-${a.id}`,
          title: `Assignment: ${a.title}`,
          description: a.instructions,
          type: 'assignment',
          date: a.deadline,
          status: sub?.status || 'unsubmitted',
          isCompleted: sub?.status === 'reviewed',
        });
      }
    }

    for (const s of liveSessions) {
      events.push({
        id: `session-${s.id}`,
        title: s.title,
        description: s.description,
        type: 'live_session',
        date: s.starts_at,
        actionUrl: s.meeting_url,
      });
    }

    // Load personal study reminders from database (with offline fallback)
    try {
      const studyReminders = await listStudentStudyReminders(studentId, cohortId);
      for (const r of studyReminders) {
        events.push({
          id: r.id,
          title: r.title,
          description: r.description,
          type: 'reminder',
          date: r.scheduled_at,
          isCompleted: r.is_completed,
          reminderType: r.reminder_type,
        });
      }
    } catch {
      // ignore
    }

    // Sort chronologically
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (err) {
    console.warn('Failed to load calendar events:', err);
    return [];
  }
}

// Authoritative Unified Progress Tracking Subsystem
export async function getStudentUnifiedProgress(
  userId: string,
  cohortId: string
): Promise<StudentUnifiedProgress> {
  // 1. Try authoritative PostgreSQL RPC
  try {
    const { data, error } = await supabase.rpc('get_student_unified_progress', {
      p_student_id: userId,
      p_cohort_id: cohortId,
    });

    if (!error && data) {
      return data as StudentUnifiedProgress;
    }
  } catch (rpcErr) {
    console.warn('get_student_unified_progress RPC error, falling back:', rpcErr);
  }

  // 2. Client-side fallback aggregation
  const [courseData, assignments, sprintData] = await Promise.all([
    getStudentCourseData(userId, cohortId).catch(() => ({ cohort: null, modules: [], progress: [], enrolledCohorts: [] })),
    listAssignments(cohortId).catch(() => []),
    getStudentSprintDays(userId, cohortId).catch(() => ({
      days: [],
      completedCount: 0,
      totalDays: 15,
      streakCount: 0,
      overallScore: null,
      progressPercent: 0,
    })),
  ]);

  const allLessons = courseData.modules.flatMap((m) => m.lessons);
  const totalLessons = allLessons.length;
  const completedLessons = courseData.progress.filter((p) => p.completed).length;
  const curriculumPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const totalAssignments = assignments.length;
  let approvedAssignments = 0;
  let submittedAssignments = 0;
  try {
    const { data: subs } = await supabase
      .from('submissions')
      .select('assignment_id, status')
      .eq('student_id', userId)
      .in('assignment_id', assignments.map((a) => a.id));

    if (subs) {
      submittedAssignments = subs.length;
      approvedAssignments = subs.filter((s) => s.status === 'reviewed' || s.status === 'approved' || s.status === 'accepted').length;
    }
  } catch {
    // fallback
  }

  const assignmentPercent = totalAssignments > 0 ? Math.round((approvedAssignments / totalAssignments) * 100) : 0;
  const effectiveSprintDays = sprintData.totalDays || 15;
  const sprintPercent = sprintData.progressPercent || 0;

  // Live session attendance metrics
  let totalSessions = 0;
  let attendedSessions = 0;
  let attendanceRatePct = 100.0;
  let isAttendancePassed = true;
  try {
    const nowIso = new Date().toISOString();
    const { data: heldSessions } = await supabase
      .from('live_sessions')
      .select('id')
      .or(`cohort_id.eq.${cohortId},cohort_id.is.null`)
      .lte('starts_at', nowIso);

    totalSessions = heldSessions?.length ?? 0;
    if (totalSessions > 0) {
      const heldSessionIds = heldSessions!.map((s) => s.id);
      const { data: attData } = await supabase
        .from('session_attendance')
        .select('session_id')
        .eq('student_id', userId)
        .in('session_id', heldSessionIds)
        .in('status', ['present', 'late', 'excused']);

      attendedSessions = attData?.length ?? 0;
      attendanceRatePct = Math.round((attendedSessions / totalSessions) * 1000) / 10;
      isAttendancePassed = attendanceRatePct >= 75.0;
    }
  } catch {
    // attendance query fallback
  }

  const totalMilestones = totalLessons + totalAssignments + (sprintData.days.length > 0 ? effectiveSprintDays : 0) + totalSessions;
  const completedMilestones = completedLessons + approvedAssignments + (sprintData.days.length > 0 ? sprintData.completedCount : 0) + attendedSessions;
  const compositePercent = totalMilestones > 0 ? Math.min(100, Math.round((completedMilestones / totalMilestones) * 100)) : 0;

  const isEligibleForCert =
    curriculumPercent >= 100 &&
    (totalAssignments === 0 || approvedAssignments >= totalAssignments) &&
    (sprintData.days.length === 0 || sprintData.completedCount >= effectiveSprintDays) &&
    isAttendancePassed;

  return {
    student_id: userId,
    cohort_id: cohortId,
    enrollment: {
      is_enrolled: Boolean(courseData.cohort),
      status: 'active',
    },
    curriculum: {
      total_lessons: totalLessons,
      completed_lessons: completedLessons,
      percent: curriculumPercent,
      total_watch_seconds: 0,
    },
    assignments: {
      total_assignments: totalAssignments,
      submitted_assignments: submittedAssignments,
      approved_assignments: approvedAssignments,
      percent: assignmentPercent,
    },
    sprint_challenges: {
      configured_sprint_days: effectiveSprintDays,
      effective_sprint_days: effectiveSprintDays,
      total_challenges: sprintData.days.length,
      submitted_challenges: sprintData.completedCount,
      completed_challenges: sprintData.completedCount,
      percent: sprintPercent,
      streak_days: sprintData.streakCount,
      average_score: sprintData.overallScore,
    },
    attendance: {
      total_sessions: totalSessions,
      attended_sessions: attendedSessions,
      attendance_rate_pct: attendanceRatePct,
      min_attendance_pct: 75.0,
      is_passed: isAttendancePassed,
    },
    overall: {
      composite_percent: compositePercent,
      total_milestones: totalMilestones,
      completed_milestones: completedMilestones,
      is_completed: compositePercent >= 100,
      eligible_for_certificate: isEligibleForCert,
      has_certificate: false,
    },
  };
}

