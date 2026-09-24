// src/lib/observability/analytics.ts
// Platform SaaS analytics aggregator: active users, completion rates, submission velocity, review SLAs, and cohort conversion

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

export async function getPlatformAnalytics(forceRefresh: boolean = false): Promise<PlatformAnalytics> {
  return queryCache.getOrFetch(
    'platform_analytics',
    async () => {
      try {
        // Parallel queries to fetch operational data
        const [
          profilesRes,
          enrollmentsRes,
          lessonsProgressRes,
          submissionsRes,
          cohortsRes,
        ] = await Promise.allSettled([
          supabase.from('profiles').select('id, role, status'),
          supabase.from('enrollments').select('user_id, cohort_id, status'),
          supabase.from('lesson_progress').select('user_id, lesson_id, completed, watch_percentage'),
          supabase.from('submissions').select('id, status, is_late, created_at, updated_at'),
          supabase.from('cohorts').select('id, status'),
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
        const retentionRatePct = totalEnrolled > 0
          ? Math.round(((totalEnrolled - droppedEnrollments) / totalEnrolled) * 100)
          : 100;

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
          else if (s.status === 'needs_work' || s.status === 'resubmit') resubmitSubs++;

          if (s.is_late) lateSubs++;

          // Turnaround calculation if reviewed
          if ((s.status === 'reviewed' || s.status === 'needs_work') && s.created_at && s.updated_at) {
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
        const onTimeRatePct = totalSubmissions > 0 ? Math.round((onTimeSubmissions / totalSubmissions) * 100) : 100;

        const totalGraded = reviewedSubs + resubmitSubs;
        const avgTurnaroundHours = totalGraded > 0 ? Math.round((turnaroundHoursSum / totalGraded) * 10) / 10 : 0;
        const slaComplianceRatePct = totalGraded > 0 ? Math.round((slaCompliantCount / totalGraded) * 100) : 100;

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
        // Fallback default snapshot
        return {
          activeUsers: { total: 0, students: 0, mentors: 0, admins: 0, suspended: 0 },
          lessonCompletion: { totalEnrollments: 0, completedLessons: 0, completionRatePct: 0, avgWatchPercentage: 0 },
          assignmentSubmissions: { totalSubmissions: 0, pendingCount: 0, reviewedCount: 0, resubmitCount: 0, onTimeSubmissions: 0, lateSubmissions: 0, onTimeRatePct: 100 },
          reviewTurnaround: { totalGraded: 0, pendingQueue: 0, avgTurnaroundHours: 0, slaComplianceRatePct: 100 },
          cohortConversion: { totalCohorts: 0, activeCohorts: 0, totalEnrolledStudents: 0, completedEnrollments: 0, droppedEnrollments: 0, waitlistedStudents: 0, retentionRatePct: 100 },
          computedAt: new Date().toISOString(),
        };
      }
    },
    60_000,
    ['stats', 'analytics'],
    forceRefresh
  );
}

