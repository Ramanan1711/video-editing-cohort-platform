import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateEnrollmentDeadline,
  calculateAccessExpiryDate,
  formatDisplayDate,
  getCohortEffectiveEndDate,
  checkCohortEnrollmentDeadline,
  checkStudentLoginAccess,
  ENROLLMENT_DEADLINE_DAYS_BEFORE_END,
  LOGIN_ACCESS_DURATION_DAYS_AFTER_END,
} from '../../lib/studentAccessService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Student Access Duration & Enrollment Deadline Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Date Calculation & Formatting Utilities', () => {
    it('verifies constant policies: 30 days deadline before end, 60 days access after end', () => {
      expect(ENROLLMENT_DEADLINE_DAYS_BEFORE_END).toBe(30);
      expect(LOGIN_ACCESS_DURATION_DAYS_AFTER_END).toBe(60);
    });

    it('formats display dates into human-readable strings', () => {
      expect(formatDisplayDate('2026-11-15T00:00:00.000Z')).toBe('15 Nov 2026');
      expect(formatDisplayDate('2027-01-14T00:00:00.000Z')).toBe('14 Jan 2027');
      expect(formatDisplayDate('invalid-date')).toBe('');
    });

    it('calculates enrollment deadline as 30 days before course end date', () => {
      const courseEnd = new Date('2026-11-15T00:00:00.000Z');
      const deadline = calculateEnrollmentDeadline(courseEnd);

      // 15 Nov minus 30 days = 16 Oct
      expect(formatDisplayDate(deadline)).toBe('16 Oct 2026');
    });

    it('calculates login access expiry date as course end date + 60 days', () => {
      const courseEnd = new Date('2026-11-15T00:00:00.000Z');
      const expiry = calculateAccessExpiryDate(courseEnd);

      // 15 Nov + 60 days = 14 Jan 2027
      expect(formatDisplayDate(expiry)).toBe('14 Jan 2027');
    });

    it('derives effective end date from start_date and duration_days when end_date is omitted', () => {
      const cohort = {
        start_date: '2026-11-01T00:00:00.000Z',
        duration_days: 15,
      };
      const effectiveEnd = getCohortEffectiveEndDate(cohort);
      expect(effectiveEnd).not.toBeNull();
      expect(formatDisplayDate(effectiveEnd!)).toBe('16 Nov 2026');
    });
  });

  describe('Enrollment Deadline Condition (30 Days Before Course End Date)', () => {
    const cohortWithEndDate = {
      id: 'cohort-nov-15',
      name: 'Batch 15 Video Editing Sprint',
      end_date: '2026-11-15T00:00:00.000Z',
    };

    it('blocks enrollment when attempted on 17 Oct 2026 for a course ending 15 Nov 2026', () => {
      // User scenario: Course end date is 15 Nov 2026, attempt is 17 Oct 2026
      const attemptDate = new Date('2026-10-17T12:00:00.000Z');
      const result = checkCohortEnrollmentDeadline(cohortWithEndDate, attemptDate);

      expect(result.isClosed).toBe(true);
      expect(result.reason).toContain('Admissions for this cohort closed 30 days prior to the course end date (15 Nov 2026)');
      expect(result.formattedCourseEndDate).toBe('15 Nov 2026');
      expect(result.formattedDeadlineDate).toBe('16 Oct 2026');
    });

    it('allows enrollment when attempted prior to the 30-day deadline (e.g. 10 Oct 2026)', () => {
      const attemptDate = new Date('2026-10-10T12:00:00.000Z');
      const result = checkCohortEnrollmentDeadline(cohortWithEndDate, attemptDate);

      expect(result.isClosed).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('honors explicit enrollment_end date if configured earlier', () => {
      const cohort = {
        end_date: '2026-11-15T00:00:00.000Z',
        enrollment_end: '2026-10-05T00:00:00.000Z',
      };
      const attemptDate = new Date('2026-10-08T12:00:00.000Z');
      const result = checkCohortEnrollmentDeadline(cohort, attemptDate);

      expect(result.isClosed).toBe(true);
      expect(result.reason).toContain('Enrollment for this cohort closed on 5 Oct 2026');
    });
  });

  describe('Student Login Access Duration (Course End Date + 60 Days)', () => {
    it('permits login access when current date is within course end date + 60 days', async () => {
      const mockEnrollments = [
        { cohort_id: 'cohort-1', status: 'enrolled' },
      ];
      const mockCohorts = [
        {
          id: 'cohort-1',
          title: 'Creative Editing Sprint',
          end_date: '2026-11-15T00:00:00.000Z',
        },
      ];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null }),
              }),
            }),
          };
        }
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockCohorts, error: null }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      // Login attempt on 1 Dec 2026 (during course or within 60 days after 15 Nov)
      const testDate = new Date('2026-12-01T10:00:00.000Z');
      const access = await checkStudentLoginAccess('student-123', testDate);

      expect(access.hasAccess).toBe(true);
      expect(access.isEnrolled).toBe(true);
      expect(access.formattedCourseEndDate).toBe('15 Nov 2026');
      expect(access.formattedAccessExpiryDate).toBe('14 Jan 2027');
    });

    it('denies login access and reports exact course end date when 60 days post-course access has expired', async () => {
      const mockEnrollments = [
        { cohort_id: 'cohort-1', status: 'completed' },
      ];
      const mockCohorts = [
        {
          id: 'cohort-1',
          title: 'Creative Editing Sprint',
          end_date: '2026-11-15T00:00:00.000Z',
        },
      ];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null }),
              }),
            }),
          };
        }
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockCohorts, error: null }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      // Login attempt on 20 Jan 2027 (past 15 Nov 2026 + 60 days = 14 Jan 2027)
      const testDate = new Date('2027-01-20T10:00:00.000Z');
      const access = await checkStudentLoginAccess('student-123', testDate);

      expect(access.hasAccess).toBe(false);
      expect(access.isEnrolled).toBe(true);
      expect(access.formattedCourseEndDate).toBe('15 Nov 2026');
      expect(access.formattedAccessExpiryDate).toBe('14 Jan 2027');
      expect(access.message).toContain('Your login access duration has expired');
      expect(access.message).toContain('14 Jan 2027');
      expect(access.message).toContain('15 Nov 2026');
    });

    it('extends access duration to the latest end date if student is enrolled in multiple courses', async () => {
      const mockEnrollments = [
        { cohort_id: 'cohort-expired', status: 'completed' },
        { cohort_id: 'cohort-active', status: 'enrolled' },
      ];
      const mockCohorts = [
        {
          id: 'cohort-expired',
          title: 'Old Spring Cohort',
          end_date: '2026-05-01T00:00:00.000Z', // Expired June 2026
        },
        {
          id: 'cohort-active',
          title: 'Autumn Masterclass',
          end_date: '2026-11-15T00:00:00.000Z', // Expires Jan 2027
        },
      ];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null }),
              }),
            }),
          };
        }
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockCohorts, error: null }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      // In October 2026: Old cohort expired, but Autumn cohort is active
      const testDate = new Date('2026-10-27T10:00:00.000Z');
      const access = await checkStudentLoginAccess('student-multi', testDate);

      expect(access.hasAccess).toBe(true);
      expect(access.formattedCourseEndDate).toBe('15 Nov 2026');
      expect(access.formattedAccessExpiryDate).toBe('14 Jan 2027');
    });

    it('allows access for newly registered students who are not yet enrolled in any course', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const access = await checkStudentLoginAccess('new-student-no-enrollments');
      expect(access.hasAccess).toBe(true);
      expect(access.isEnrolled).toBe(false);
    });
  });
});

