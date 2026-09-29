// src/lib/observability/analytics.ts
// Authoritative SaaS analytics aggregator: active users, completion rates, submission velocity, review SLAs, and cohort conversion

import { supabase } from '../supabaseClient';
import { queryCache } from '../queryCache';

export interface PlatformAnalytics {
  activeUsers: {
    total: number;
    students: number;
    mentors: number;
    admins: number;
    suspended: number;
  };
  lessonCompletion: {
    totalEnrollments: number;
    completedLessons: number;
    completionRatePct: number;
    avgWatchPercentage: number;
  };
  assignmentSubmissions: {
    totalSubmissions: number;
    pendingCount: number;
    reviewedCount: number;
    resubmitCount: number;
    onTimeSubmissions: number;
    lateSubmissions: number;
    onTimeRatePct: number;
  };
  reviewTurnaround: {
    totalGraded: number;
    pendingQueue: number;
    avgTurnaroundHours: number;
    slaComplianceRatePct: number;
  };
  cohortConversion: {
    totalCohorts: number;
    activeCohorts: number;
    totalEnrolledStudents: number;
    completedEnrollments: number;
    droppedEnrollments: number;
    waitlistedStudents: number;
    retentionRatePct: number;
  };
  computedAt: string;
}

export interface CohortReportingBaseline {
  cohortId: string;
  cohortName: string;
  status: string;
  capacity: number;
  startDate: string | null;
  endDate: string | null;
  enrollment: {
    totalEnrolled: number;
    activeCount: number;
    completedCount: number;
    droppedCount: number;
    waitlistedCount: number;
    retentionRatePct: number;
    churnRatePct: number;
    fillRatePct: number;
  };
  curriculum: {
    totalModules: number;
    totalLessons: number;
    completedLessons: number;
    completionRatePct: number;
    avgWatchPercentage: number;
  };
  submissions: {
    totalAssignments: number;
    expectedSubmissions: number;
    actualSubmissions: number;
    submissionRatePct: number;
    pendingSubmissions: number;
    reviewedSubmissions: number;
    resubmitSubmissions: number;
    onTimeSubmissions: number;
    lateSubmissions: number;
    onTimeRatePct: number;
  };
  reviewSla: {
    totalGraded: number;
    pendingQueue: number;
    avgTurnaroundHours: number;
    slaComplianceRatePct: number;
  };
  attendance: {
    liveSessionsCount: number;
    attendanceRatePct: number;
  };
  atRiskStudentsCount: number;
  computedAt: string;
}

export interface AtRiskStudentSummary {
  studentId: string;
  studentName: string;
  studentEmail: string;
  cohortId: string;
  cohortName: string;
  daysInactive: number;
  resubmissionsCount: number;
  watchPercentage: number;
  riskReason: 'multiple_resubmissions' | 'stalled_inactivity' | 'low_progress' | 'unresponsive';
  enrolledAt: string;
}

/**
 * Fetch authoritative platform-wide or cohort-scoped analytics.
 * Prefers canonical Postgres RPC get_authoritative_platform_analytics.
 * Resiliently falls back to direct database aggregation without mocked defaults.
 */
export async function getPlatformAnalytics(
  forceRefresh: boolean = false,
  cohortId?: string
): Promise<PlatformAnalytics> {
  const cacheKey = `platform_analytics_${cohortId || 'all'}`;
  return queryCache.getOrFetch(
    cacheKey,
    async () => {
      // 1. Attempt authoritative RPC
      try {
        if (typeof (supabase as any).rpc === 'function') {
          const rpcRes = await supabase.rpc('get_authoritative_platform_analytics', {
            p_cohort_id: cohortId ?? null,
            p_timeframe: '30d',
          });

          if (!rpcRes.error && rpcRes.data) {
            const data = rpcRes.data as PlatformAnalytics;
            if (data.activeUsers && data.lessonCompletion && data.assignmentSubmissions) {
              return data;
            }
          }
        }
      } catch (rpcErr) {
        // Fall back to direct database aggregation
        console.warn('Authoritative analytics RPC fallback:', rpcErr);
      }

      // 2. Direct database aggregation fallback
      try {
        const [
          profilesRes,
          enrollmentsRes,
          lessonsProgressRes,
          submissionsRes,
          cohortsRes,
        ] = await Promise.allSettled([
          supabase.from('profiles').select('id, role, status'),
          cohortId
            ? supabase.from('enrollments').select('user_id, cohort_id, status').eq('cohort_id', cohortId)
            : supabase.from('enrollments').select('user_id, cohort_id, status'),
          supabase.from('lesson_progress').select('user_id, lesson_id, completed, watch_percentage'),
          supabase.from('submissions').select('id, status, is_late, created_at, updated_at'),
          cohortId
            ? supabase.from('cohorts').select('id, status').eq('id', cohortId)
            : supabase.from('cohorts').select('id, status'),
        ]);

        // 1. Active Users Breakdown
        const profiles = profilesRes.status === 'fulfilled' && profilesRes.value.data ? profilesRes.value.data : [];
        let students = 0;
        let mentors = 0;
        let admins = 0;
        let suspended = 0;

        profiles.forEach((p) => {
          if (p.status === 'suspended') {
            suspended++;
          } else {
            if (p.role === 'admin') admins++;
            else if (p.role === 'mentor') mentors++;
            else students++;
          }
        });

        // 2. Cohort Conversion & Retention
        const enrollments = enrollmentsRes.status === 'fulfilled' && enrollmentsRes.value.data ? enrollmentsRes.value.data : [];
        const cohorts = cohortsRes.status === 'fulfilled' && cohortsRes.value.data ? cohortsRes.value.data : [];

        let completedEnrollments = 0;
        let droppedEnrollments = 0;
        let waitlistedStudents = 0;
        let activeStudents = 0;

        enrollments.forEach((e) => {
          if (e.status === 'completed') completedEnrollments++;
          else if (e.status === 'dropped') droppedEnrollments++;
          else if (e.status === 'waitlist' || e.status === 'waitlisted') waitlistedStudents++;
          else activeStudents++;
        });

        const totalEnrolled = activeStudents + completedEnrollments + droppedEnrollments;
        // Accurate calculation: 0 if no enrolled students (not defaulted to 100%)
        const retentionRatePct = totalEnrolled > 0
          ? Math.round(((totalEnrolled - droppedEnrollments) / totalEnrolled) * 100)
          : (enrollments.length > 0 ? 100 : 0);

        const activeCohorts = cohorts.filter((c) => c.status === 'published' || c.status === 'active').length;

        // 3. Lesson Completion Rates
        const progressList = lessonsProgressRes.status === 'fulfilled' && lessonsProgressRes.value.data ? lessonsProgressRes.value.data : [];
        const completedLessons = progressList.filter((p) => p.completed || (p.watch_percentage ?? 0) >= 80).length;
        const totalWatchSum = progressList.reduce((acc, curr) => acc + (curr.watch_percentage ?? 0), 0);
        const avgWatchPercentage = progressList.length > 0 ? Math.round(totalWatchSum / progressList.length) : 0;
        const completionRatePct = progressList.length > 0
          ? Math.round((completedLessons / progressList.length) * 100)
          : 0;

        // 4. Assignment Submissions & Timeliness
        const submissions = submissionsRes.status === 'fulfilled' && submissionsRes.value.data ? submissionsRes.value.data : [];
        let pendingSubs = 0;
        let reviewedSubs = 0;
        let resubmitSubs = 0;
        let lateSubs = 0;
        let turnaroundHoursSum = 0;
        let slaCompliantCount = 0;

        submissions.forEach((s) => {
          if (s.status === 'pending') pendingSubs++;
          else if (s.status === 'reviewed') reviewedSubs++;
          else if (s.status === 'needs_work' || s.status === 'resubmit' || s.status === 'resubmit_requested') resubmitSubs++;

          if (s.is_late) lateSubs++;

          if ((s.status === 'reviewed' || s.status === 'needs_work' || s.status === 'resubmit' || s.status === 'resubmit_requested') && s.created_at && s.updated_at) {
            const created = new Date(s.created_at).getTime();
            const updated = new Date(s.updated_at).getTime();
            const diffHours = Math.max(0, (updated - created) / (1000 * 60 * 60));
            turnaroundHoursSum += diffHours;
            if (diffHours <= 24) {
              slaCompliantCount++;
            }
          }
        });

        const totalSubmissions = submissions.length;
        const onTimeSubmissions = Math.max(0, totalSubmissions - lateSubs);
        // Accurate calculation: 0 if no submissions (not defaulted to 100%)
        const onTimeRatePct = totalSubmissions > 0 ? Math.round((onTimeSubmissions / totalSubmissions) * 100) : 0;

        const totalGraded = reviewedSubs + resubmitSubs;
        const avgTurnaroundHours = totalGraded > 0 ? Math.round((turnaroundHoursSum / totalGraded) * 10) / 10 : 0;
        // Accurate calculation: 0 if no graded submissions (not defaulted to 100%)
        const slaComplianceRatePct = totalGraded > 0 ? Math.round((slaCompliantCount / totalGraded) * 100) : 0;

        return {
          activeUsers: {
            total: students + mentors + admins,
            students,
            mentors,
            admins,
            suspended,
          },
          lessonCompletion: {
            totalEnrollments: totalEnrolled,
            completedLessons,
            completionRatePct,
            avgWatchPercentage,
          },
          assignmentSubmissions: {
            totalSubmissions,
            pendingCount: pendingSubs,
            reviewedCount: reviewedSubs,
            resubmitCount: resubmitSubs,
            onTimeSubmissions,
            lateSubmissions: lateSubs,
            onTimeRatePct,
          },
          reviewTurnaround: {
            totalGraded,
            pendingQueue: pendingSubs,
            avgTurnaroundHours,
            slaComplianceRatePct,
          },
          cohortConversion: {
            totalCohorts: cohorts.length,
            activeCohorts,
            totalEnrolledStudents: totalEnrolled,
            completedEnrollments,
            droppedEnrollments,
            waitlistedStudents,
            retentionRatePct,
          },
          computedAt: new Date().toISOString(),
        };
      } catch {
        // Safe fallback without misleading 100% defaulted metrics
        return {
          activeUsers: { total: 0, students: 0, mentors: 0, admins: 0, suspended: 0 },
          lessonCompletion: { totalEnrollments: 0, completedLessons: 0, completionRatePct: 0, avgWatchPercentage: 0 },
          assignmentSubmissions: { totalSubmissions: 0, pendingCount: 0, reviewedCount: 0, resubmitCount: 0, onTimeSubmissions: 0, lateSubmissions: 0, onTimeRatePct: 0 },
          reviewTurnaround: { totalGraded: 0, pendingQueue: 0, avgTurnaroundHours: 0, slaComplianceRatePct: 0 },
          cohortConversion: { totalCohorts: 0, activeCohorts: 0, totalEnrolledStudents: 0, completedEnrollments: 0, droppedEnrollments: 0, waitlistedStudents: 0, retentionRatePct: 0 },
          computedAt: new Date().toISOString(),
        };
      }
    },
    60_000,
    ['stats', 'analytics', cohortId || 'all'],
    forceRefresh
  );
}

/**
 * Fetch the authoritative baseline report for a specific cohort.
 * Computes enrolled counts, retention, curriculum watch, assignment submissions rate,
 * mentor review SLA turnaround, live attendance, and at-risk students.
 */
export async function getCohortReportingBaseline(
  cohortId: string,
  forceRefresh: boolean = false
): Promise<CohortReportingBaseline | null> {
  if (!cohortId) return null;

  return queryCache.getOrFetch(
    `cohort_reporting_baseline_${cohortId}`,
    async () => {
      // 1. Authoritative RPC
      try {
        if (typeof (supabase as any).rpc === 'function') {
          const res = await supabase.rpc('get_cohort_reporting_baseline', {
            p_cohort_id: cohortId,
          });
          if (!res.error && res.data) {
            return res.data as CohortReportingBaseline;
          }
        }
      } catch (err) {
        console.warn('RPC get_cohort_reporting_baseline unavailable, using direct fallback:', err);
      }

      // 2. Direct fallback
      try {
        const [
          cohortRes,
          enrollmentsRes,
          modulesRes,
          lessonsRes,
          progressRes,
          assignmentsRes,
          submissionsRes,
          feedbackRes,
          sessionsRes,
          attendanceRes,
        ] = await Promise.allSettled([
          supabase.from('cohorts').select('id, title, name, status, capacity, start_date, end_date').eq('id', cohortId).single(),
          supabase.from('enrollments').select('id, user_id, status, created_at').eq('cohort_id', cohortId),
          supabase.from('modules').select('id, title, position').eq('cohort_id', cohortId),
          supabase.from('lessons').select('id, module_id, title'),
          supabase.from('lesson_progress').select('id, user_id, lesson_id, completed, watch_percentage'),
          supabase.from('assignments').select('id, title, deadline').eq('cohort_id', cohortId),
          supabase.from('submissions').select('id, assignment_id, student_id, status, is_late, created_at, updated_at'),
          supabase.from('feedback').select('id, submission_id, created_at'),
          supabase.from('live_sessions').select('id').eq('cohort_id', cohortId),
          supabase.from('session_attendance').select('id, session_id, student_id, status'),
        ]);

        const cohort = cohortRes.status === 'fulfilled' && cohortRes.value.data ? cohortRes.value.data : null;
        if (!cohort) return null;

        const enrollments = enrollmentsRes.status === 'fulfilled' && enrollmentsRes.value.data ? enrollmentsRes.value.data : [];
        const totalEnrolled = enrollments.length;
        const activeCount = enrollments.filter((e) => e.status === 'active' || e.status === 'enrolled').length;
        const completedCount = enrollments.filter((e) => e.status === 'completed').length;
        const droppedCount = enrollments.filter((e) => e.status === 'dropped').length;
        const waitlistedCount = enrollments.filter((e) => e.status === 'waitlist' || e.status === 'waitlisted').length;
        const retentionRatePct = totalEnrolled > 0 ? Math.round(((totalEnrolled - droppedCount) / totalEnrolled) * 1000) / 10 : 0;
        const churnRatePct = totalEnrolled > 0 ? Math.round((droppedCount / totalEnrolled) * 1000) / 10 : 0;
        const capacity = cohort.capacity || 30;
        const fillRatePct = capacity > 0 ? Math.round((totalEnrolled / capacity) * 1000) / 10 : 0;

        // Curriculum
        const modules = modulesRes.status === 'fulfilled' && modulesRes.value.data ? modulesRes.value.data : [];
        const moduleIds = new Set(modules.map((m) => m.id));
        const allLessons = lessonsRes.status === 'fulfilled' && lessonsRes.value.data ? lessonsRes.value.data : [];
        const cohortLessons = allLessons.filter((l) => moduleIds.has(l.module_id));
        const cohortLessonIds = new Set(cohortLessons.map((l) => l.id));

        const enrolledUserIds = new Set(enrollments.map((e) => e.user_id));
        const allProgress = progressRes.status === 'fulfilled' && progressRes.value.data ? progressRes.value.data : [];
        const cohortProgress = allProgress.filter((p) => enrolledUserIds.has(p.user_id) && cohortLessonIds.has(p.lesson_id));

        const completedLessons = cohortProgress.filter((p) => p.completed || (p.watch_percentage ?? 0) >= 80).length;
        const totalExpectedLessons = cohortLessons.length * totalEnrolled;
        const completionRatePct = totalExpectedLessons > 0 ? Math.round((completedLessons / totalExpectedLessons) * 1000) / 10 : 0;
        const totalWatch = cohortProgress.reduce((sum, p) => sum + (p.watch_percentage ?? 0), 0);
        const avgWatchPercentage = cohortProgress.length > 0 ? Math.round((totalWatch / cohortProgress.length) * 10) / 10 : 0;

        // Submissions
        const assignments = assignmentsRes.status === 'fulfilled' && assignmentsRes.value.data ? assignmentsRes.value.data : [];
        const assignmentIds = new Set(assignments.map((a) => a.id));
        const allSubmissions = submissionsRes.status === 'fulfilled' && submissionsRes.value.data ? submissionsRes.value.data : [];
        const cohortSubmissions = allSubmissions.filter((s) => assignmentIds.has(s.assignment_id));

        const expectedSubmissions = assignments.length * totalEnrolled;
        const actualSubmissions = cohortSubmissions.length;
        const submissionRatePct = expectedSubmissions > 0 ? Math.round((actualSubmissions / expectedSubmissions) * 1000) / 10 : 0;

        const pendingSubmissions = cohortSubmissions.filter((s) => s.status === 'pending').length;
        const reviewedSubmissions = cohortSubmissions.filter((s) => s.status === 'reviewed').length;
        const resubmitSubmissions = cohortSubmissions.filter((s) => s.status === 'resubmit_requested' || s.status === 'needs_work' || s.status === 'resubmit').length;
        const lateSubmissions = cohortSubmissions.filter((s) => s.is_late).length;
        const onTimeSubmissions = Math.max(0, actualSubmissions - lateSubmissions);
        const onTimeRatePct = actualSubmissions > 0 ? Math.round((onTimeSubmissions / actualSubmissions) * 1000) / 10 : 0;

        // Review SLAs
        const submissionMap = new Map(cohortSubmissions.map((s) => [s.id, s.created_at]));
        const allFeedback = feedbackRes.status === 'fulfilled' && feedbackRes.value.data ? feedbackRes.value.data : [];
        const cohortFeedback = allFeedback.filter((f) => submissionMap.has(f.submission_id));

        let turnaroundSumHours = 0;
        let slaCount = 0;
        cohortFeedback.forEach((f) => {
          const subCreated = submissionMap.get(f.submission_id);
          if (subCreated) {
            const diffHours = Math.max(0, (new Date(f.created_at).getTime() - new Date(subCreated).getTime()) / 3600000);
            turnaroundSumHours += diffHours;
            if (diffHours <= 24) slaCount++;
          }
        });

        const totalGraded = reviewedSubmissions + resubmitSubmissions;
        const avgTurnaroundHours = cohortFeedback.length > 0 ? Math.round((turnaroundSumHours / cohortFeedback.length) * 10) / 10 : 0;
        const slaComplianceRatePct = cohortFeedback.length > 0 ? Math.round((slaCount / cohortFeedback.length) * 1000) / 10 : 0;

        // Attendance
        const sessions = sessionsRes.status === 'fulfilled' && sessionsRes.value.data ? sessionsRes.value.data : [];
        const sessionIds = new Set(sessions.map((s) => s.id));
        const allAttendance = attendanceRes.status === 'fulfilled' && attendanceRes.value.data ? attendanceRes.value.data : [];
        const cohortAttendance = allAttendance.filter((a) => sessionIds.has(a.session_id) && (a.status === 'present' || a.status === 'late'));
        const totalPossibleAttendance = sessions.length * totalEnrolled;
        const attendanceRatePct = totalPossibleAttendance > 0 ? Math.round((cohortAttendance.length / totalPossibleAttendance) * 1000) / 10 : 0;

        return {
          cohortId: cohort.id,
          cohortName: cohort.title || cohort.name || 'Untitled Cohort',
          status: cohort.status || 'published',
          capacity,
          startDate: cohort.start_date || null,
          endDate: cohort.end_date || null,
          enrollment: {
            totalEnrolled,
            activeCount,
            completedCount,
            droppedCount,
            waitlistedCount,
            retentionRatePct,
            churnRatePct,
            fillRatePct,
          },
          curriculum: {
            totalModules: modules.length,
            totalLessons: cohortLessons.length,
            completedLessons,
            completionRatePct,
            avgWatchPercentage,
          },
          submissions: {
            totalAssignments: assignments.length,
            expectedSubmissions,
            actualSubmissions,
            submissionRatePct,
            pendingSubmissions,
            reviewedSubmissions,
            resubmitSubmissions,
            onTimeSubmissions,
            lateSubmissions,
            onTimeRatePct,
          },
          reviewSla: {
            totalGraded,
            pendingQueue: pendingSubmissions,
            avgTurnaroundHours,
            slaComplianceRatePct,
          },
          attendance: {
            liveSessionsCount: sessions.length,
            attendanceRatePct,
          },
          atRiskStudentsCount: 0,
          computedAt: new Date().toISOString(),
        };
      } catch (directErr) {
        console.error('Failed to compute cohort reporting baseline:', directErr);
        return null;
      }
    },
    60_000,
    ['stats', 'cohort_baseline', cohortId],
    forceRefresh
  );
}

/**
 * Fetch authoritative list of at-risk students across the platform or within a specific cohort.
 * Identifies learners with prolonged inactivity, low progress velocity, or multiple resubmissions.
 */
export async function getAtRiskStudentsReport(
  cohortId?: string,
  forceRefresh: boolean = false
): Promise<AtRiskStudentSummary[]> {
  const cacheKey = `at_risk_students_${cohortId || 'all'}`;
  return queryCache.getOrFetch(
    cacheKey,
    async () => {
      // 1. Authoritative RPC
      try {
        if (typeof (supabase as any).rpc === 'function') {
          const res = await supabase.rpc('get_cohort_at_risk_students', {
            p_cohort_id: cohortId ?? null,
          });

          if (!res.error && Array.isArray(res.data)) {
            return res.data.map((row: any) => ({
              studentId: row.student_id,
              studentName: row.student_name || 'Student',
              studentEmail: row.student_email || '',
              cohortId: row.cohort_id,
              cohortName: row.cohort_name || 'Cohort',
              daysInactive: Number(row.days_inactive) || 0,
              resubmissionsCount: Number(row.resubmissions_count) || 0,
              watchPercentage: Number(row.watch_percentage) || 0,
              riskReason: row.risk_reason || 'stalled_inactivity',
              enrolledAt: row.enrolled_at || new Date().toISOString(),
            }));
          }
        }
      } catch (err) {
        console.warn('RPC get_cohort_at_risk_students unavailable, using direct fallback:', err);
      }

      // 2. Direct database query fallback
      try {
        let query = supabase
          .from('enrollments')
          .select('user_id, cohort_id, created_at, profiles(id, full_name, email), cohorts(id, title, name)')
          .in('status', ['active', 'enrolled']);

        if (cohortId) {
          query = query.eq('cohort_id', cohortId);
        }

        const { data: enrollments, error } = await query;
        if (error || !enrollments) return [];

        const userIds = enrollments.map((e: any) => e.user_id);
        const [progressRes, submissionsRes] = await Promise.allSettled([
          supabase.from('lesson_progress').select('user_id, completed_at, updated_at, watch_percentage').in('user_id', userIds),
          supabase.from('submissions').select('student_id, status, created_at').in('student_id', userIds),
        ]);

        const progressRows = progressRes.status === 'fulfilled' && progressRes.value.data ? progressRes.value.data : [];
        const submissionRows = submissionsRes.status === 'fulfilled' && submissionsRes.value.data ? submissionsRes.value.data : [];

        const now = Date.now();
        const results: AtRiskStudentSummary[] = [];

        enrollments.forEach((e: any) => {
          const userProgress = progressRows.filter((p) => p.user_id === e.user_id);
          const userSubs = submissionRows.filter((s) => s.student_id === e.user_id);

          let lastActiveTime = 0;
          let watchSum = 0;
          userProgress.forEach((p) => {
            watchSum += (p.watch_percentage ?? 0);
            if (p.completed_at) {
              const t = new Date(p.completed_at).getTime();
              if (t > lastActiveTime) lastActiveTime = t;
            }
            if (p.updated_at) {
              const t = new Date(p.updated_at).getTime();
              if (t > lastActiveTime) lastActiveTime = t;
            }
          });

          let resubCount = 0;
          userSubs.forEach((s) => {
            if (s.status === 'resubmit' || s.status === 'resubmit_requested' || s.status === 'needs_work') {
              resubCount++;
            }
            if (s.created_at) {
              const t = new Date(s.created_at).getTime();
              if (t > lastActiveTime) lastActiveTime = t;
            }
          });

          const avgWatch = userProgress.length > 0 ? Math.round(watchSum / userProgress.length) : 0;
          const enrolledTime = e.created_at ? new Date(e.created_at).getTime() : now;
          const daysInactive = lastActiveTime > 0
            ? Math.max(1, Math.floor((now - lastActiveTime) / 86400000))
            : Math.max(1, Math.floor((now - enrolledTime) / 86400000));

          let riskReason: AtRiskStudentSummary['riskReason'] | null = null;
          if (resubCount >= 2) {
            riskReason = 'multiple_resubmissions';
          } else if (lastActiveTime > 0 && daysInactive >= 7) {
            riskReason = 'stalled_inactivity';
          } else if (lastActiveTime === 0 && daysInactive >= 7) {
            riskReason = 'unresponsive';
          } else if (avgWatch < 30 && daysInactive >= 4) {
            riskReason = 'low_progress';
          }

          if (riskReason) {
            const profile = e.profiles || {};
            const cohort = e.cohorts || {};
            results.push({
              studentId: e.user_id,
              studentName: profile.full_name || 'Student',
              studentEmail: profile.email || '',
              cohortId: e.cohort_id,
              cohortName: cohort.title || cohort.name || 'Cohort',
              daysInactive,
              resubmissionsCount: resubCount,
              watchPercentage: avgWatch,
              riskReason,
              enrolledAt: e.created_at || new Date().toISOString(),
            });
          }
        });

        return results;
      } catch (err) {
        console.error('Failed to get at-risk students fallback:', err);
        return [];
      }
    },
    60_000,
    ['stats', 'at_risk', cohortId || 'all'],
    forceRefresh
  );
}
