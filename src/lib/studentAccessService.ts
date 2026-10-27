import { supabase } from './supabaseClient';

export const ENROLLMENT_DEADLINE_DAYS_BEFORE_END = 30;
export const LOGIN_ACCESS_DURATION_DAYS_AFTER_END = 60;

export interface StudentAccessResult {
  hasAccess: boolean;
  isEnrolled: boolean;
  courseEndDate: string | null;
  accessExpiryDate: string | null;
  formattedCourseEndDate: string | null;
  formattedAccessExpiryDate: string | null;
  message?: string;
}

export interface EnrollmentDeadlineCheck {
  isClosed: boolean;
  reason?: string;
  deadlineDate?: Date;
  courseEndDate?: Date;
  formattedCourseEndDate?: string;
  formattedDeadlineDate?: string;
}

/**
 * Formats a date consistently for student display (e.g., "15 Nov 2026", "15 Jan 2027").
 */
export function formatDisplayDate(dateInput: string | Date | number): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = d.getUTCDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Calculates the exact enrollment deadline: 30 days before the course end date.
 */
export function calculateEnrollmentDeadline(
  endDate: string | Date,
  daysBeforeEnd: number = ENROLLMENT_DEADLINE_DAYS_BEFORE_END
): Date {
  const d = new Date(endDate);
  return new Date(d.getTime() - daysBeforeEnd * 24 * 60 * 60 * 1000);
}

/**
 * Calculates the exact login access expiry date: course end date + 60 days.
 */
export function calculateAccessExpiryDate(
  endDate: string | Date,
  daysAfterEnd: number = LOGIN_ACCESS_DURATION_DAYS_AFTER_END
): Date {
  const d = new Date(endDate);
  return new Date(d.getTime() + daysAfterEnd * 24 * 60 * 60 * 1000);
}

/**
 * Resolves the effective course end date from a cohort object.
 * Priority:
 * 1. cohort.end_date
 * 2. cohort.start_date + cohort.duration_days
 */
export function getCohortEffectiveEndDate(cohort: {
  end_date?: string | null;
  start_date?: string | null;
  duration_days?: number | null;
}): Date | null {
  if (cohort.end_date) {
    const parsed = new Date(cohort.end_date);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (cohort.start_date && cohort.duration_days) {
    const start = new Date(cohort.start_date);
    if (!isNaN(start.getTime())) {
      return new Date(start.getTime() + cohort.duration_days * 24 * 60 * 60 * 1000);
    }
  }
  return null;
}

/**
 * Evaluates whether enrollment in a cohort is currently closed based on:
 * - 30-day deadline before the course end date
 * - explicit cohort.enrollment_end date
 */
export function checkCohortEnrollmentDeadline(
  cohort: {
    end_date?: string | null;
    start_date?: string | null;
    duration_days?: number | null;
    enrollment_end?: string | null;
  },
  currentDate: Date = new Date()
): EnrollmentDeadlineCheck {
  const effectiveEndDate = getCohortEffectiveEndDate(cohort);

  if (effectiveEndDate) {
    const deadlineDate = calculateEnrollmentDeadline(effectiveEndDate);
    const formattedCourseEndDate = formatDisplayDate(effectiveEndDate);
    const formattedDeadlineDate = formatDisplayDate(deadlineDate);

    // If current date is past the 30-day deadline before course end date
    if (currentDate.getTime() > deadlineDate.getTime()) {
      return {
        isClosed: true,
        reason: `Admissions for this cohort closed 30 days prior to the course end date (${formattedCourseEndDate}).`,
        deadlineDate,
        courseEndDate: effectiveEndDate,
        formattedCourseEndDate,
        formattedDeadlineDate,
      };
    }
  }

  // Also check explicit enrollment_end if present
  if (cohort.enrollment_end) {
    const explicitEnd = new Date(cohort.enrollment_end);
    if (!isNaN(explicitEnd.getTime()) && currentDate.getTime() > explicitEnd.getTime()) {
      return {
        isClosed: true,
        reason: `Enrollment for this cohort closed on ${formatDisplayDate(explicitEnd)}.`,
        deadlineDate: explicitEnd,
        formattedDeadlineDate: formatDisplayDate(explicitEnd),
      };
    }
  }

  return { isClosed: false };
}

/**
 * Evaluates a student's active platform login access duration.
 * Rule: Access is granted up to course end date + 60 days.
 * If enrolled in multiple cohorts, access lasts until the latest expiry among all courses.
 * If unenrolled, access is granted to allow browsing and enrollment.
 */
export async function checkStudentLoginAccess(
  userId: string,
  currentDate: Date = new Date()
): Promise<StudentAccessResult> {
  try {
    // 1. Fetch user's active/completed enrollments
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('cohort_id, status')
      .eq('user_id', userId)
      .in('status', ['enrolled', 'active', 'completed']);

    if (enrollError || !enrollments || enrollments.length === 0) {
      // Unenrolled student: access allowed (can browse cohorts and enroll)
      return {
        hasAccess: true,
        isEnrolled: false,
        courseEndDate: null,
        accessExpiryDate: null,
        formattedCourseEndDate: null,
        formattedAccessExpiryDate: null,
      };
    }

    const cohortIds = enrollments.map((e) => e.cohort_id).filter(Boolean);
    if (!cohortIds.length) {
      return {
        hasAccess: true,
        isEnrolled: false,
        courseEndDate: null,
        accessExpiryDate: null,
        formattedCourseEndDate: null,
        formattedAccessExpiryDate: null,
      };
    }

    // 2. Fetch cohort end dates for all enrolled cohorts
    const { data: cohorts, error: cohortsError } = await supabase
      .from('cohorts')
      .select('id, title, name, start_date, end_date, duration_days')
      .in('id', cohortIds);

    if (cohortsError || !cohorts || cohorts.length === 0) {
      // Fail-open on network/query error so legitimate active students are not locked out
      return {
        hasAccess: true,
        isEnrolled: true,
        courseEndDate: null,
        accessExpiryDate: null,
        formattedCourseEndDate: null,
        formattedAccessExpiryDate: null,
      };
    }

    let hasAnyOpenEndedCohort = false;
    let latestExpiryDate: Date | null = null;
    let latestCourseEndDate: Date | null = null;

    for (const cohort of cohorts) {
      const endDate = getCohortEffectiveEndDate(cohort);
      if (!endDate) {
        // Any open-ended course without an end date keeps account access open
        hasAnyOpenEndedCohort = true;
        continue;
      }

      const expiryDate = calculateAccessExpiryDate(endDate);

      if (!latestExpiryDate || expiryDate.getTime() > latestExpiryDate.getTime()) {
        latestExpiryDate = expiryDate;
        latestCourseEndDate = endDate;
      }
    }

    if (hasAnyOpenEndedCohort) {
      return {
        hasAccess: true,
        isEnrolled: true,
        courseEndDate: latestCourseEndDate?.toISOString() ?? null,
        accessExpiryDate: latestExpiryDate?.toISOString() ?? null,
        formattedCourseEndDate: latestCourseEndDate ? formatDisplayDate(latestCourseEndDate) : null,
        formattedAccessExpiryDate: latestExpiryDate ? formatDisplayDate(latestExpiryDate) : null,
      };
    }

    if (latestExpiryDate && latestCourseEndDate) {
      const isExpired = currentDate.getTime() > latestExpiryDate.getTime();
      const formattedCourseEndDate = formatDisplayDate(latestCourseEndDate);
      const formattedAccessExpiryDate = formatDisplayDate(latestExpiryDate);

      if (isExpired) {
        return {
          hasAccess: false,
          isEnrolled: true,
          courseEndDate: latestCourseEndDate.toISOString(),
          accessExpiryDate: latestExpiryDate.toISOString(),
          formattedCourseEndDate,
          formattedAccessExpiryDate,
          message: `Your login access duration has expired. Enrolled student access was valid until ${formattedAccessExpiryDate} (60 days after the course ended on ${formattedCourseEndDate}).`,
        };
      }

      return {
        hasAccess: true,
        isEnrolled: true,
        courseEndDate: latestCourseEndDate.toISOString(),
        accessExpiryDate: latestExpiryDate.toISOString(),
        formattedCourseEndDate,
        formattedAccessExpiryDate,
      };
    }

    return {
      hasAccess: true,
      isEnrolled: true,
      courseEndDate: null,
      accessExpiryDate: null,
      formattedCourseEndDate: null,
      formattedAccessExpiryDate: null,
    };
  } catch {
    // Fail-open on unexpected execution failure
    return {
      hasAccess: true,
      isEnrolled: false,
      courseEndDate: null,
      accessExpiryDate: null,
      formattedCourseEndDate: null,
      formattedAccessExpiryDate: null,
    };
  }
}

