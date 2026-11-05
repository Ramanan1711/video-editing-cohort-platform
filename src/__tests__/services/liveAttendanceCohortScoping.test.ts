import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyCertificateEligibility } from '../../lib/services/certificateService';
import { getStudentUnifiedProgress } from '../../lib/services/sprintMetricsService';
import { generateInternshipReport } from '../../lib/internshipReportService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock('../../lib/services/assignmentSubmissionService', () => ({
  listAssignments: vi.fn().mockResolvedValue([
    { id: 'assign-1', title: 'Rough Cut Capstone' },
  ]),
}));

describe('Issue 1: Live Attendance Cohort Scoping & Pre-Enrollment Exclusion', () => {
  const cohortId = 'cohort-sept-2026';
  const studentId = 'student-sarah-101';
  const enrollmentDate = '2026-09-15T00:00:00Z';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('excludes global academy webinars (cohort_id is null) and sessions before enrollment date from certificate attendance gate', async () => {
    // 1. Force client fallback by simulating unavailable RPC
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { code: '42883', message: 'RPC verify_and_issue_certificate unavailable' },
    });

    // 2. Mock database tables
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    user_id: studentId,
                    cohort_id: cohortId,
                    status: 'enrolled',
                    enrolled_at: enrollmentDate,
                    created_at: enrollmentDate,
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }

      if (table === 'modules') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'mod-1',
                  lessons: [{ id: 'les-1', video_url: 'https://vimeo.com/12345' }],
                },
              ],
              error: null,
            }),
          }),
        };
      }

      if (table === 'lesson_progress') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ lesson_id: 'les-1', completed: true, watch_percentage: 100 }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'submissions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ assignment_id: 'assign-1', status: 'approved' }],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'cohorts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { sprint_duration_days: 7 },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'daily_challenges') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'ch-1', day_number: 1 },
                { id: 'ch-2', day_number: 2 },
              ],
              error: null,
            }),
          }),
        };
      }

      if (table === 'daily_challenge_submissions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { challenge_id: 'ch-1', status: 'accepted' },
                  { challenge_id: 'ch-2', status: 'accepted' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      // Live sessions mock:
      // Includes 17 historical global webinars (cohort_id = null) held months ago,
      // 5 pre-enrollment sessions held in August,
      // and 3 valid cohort workshops held after September 15th.
      if (table === 'live_sessions') {
        const historicalGlobalWebinars = Array.from({ length: 17 }, (_, i) => ({
          id: `global-webinar-${i + 1}`,
          cohort_id: null,
          starts_at: '2026-06-01T10:00:00Z',
        }));

        const preEnrollmentSessions = Array.from({ length: 5 }, (_, i) => ({
          id: `august-session-${i + 1}`,
          cohort_id: cohortId,
          starts_at: '2026-08-10T10:00:00Z',
        }));

        const validCohortSessions = [
          { id: 'session-sep-20', cohort_id: cohortId, starts_at: '2026-09-20T10:00:00Z' },
          { id: 'session-sep-27', cohort_id: cohortId, starts_at: '2026-09-27T10:00:00Z' },
          { id: 'session-oct-04', cohort_id: cohortId, starts_at: '2026-10-04T10:00:00Z' },
        ];

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                // Supabase query filters by cohort_id = cohortId, and fallback filter strictly drops any null or pre-enrollment sessions
                data: [...validCohortSessions, ...preEnrollmentSessions, ...historicalGlobalWebinars],
                error: null,
              }),
            }),
            or: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                // In case query had global webinars too:
                data: [...validCohortSessions, ...preEnrollmentSessions, ...historicalGlobalWebinars],
                error: null,
              }),
            }),
          }),
        };
      }

      // Student attended all 3 valid sessions held after enrollment
      if (table === 'session_attendance') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { session_id: 'session-sep-20', status: 'present' },
                  { session_id: 'session-sep-27', status: 'present' },
                  { session_id: 'session-oct-04', status: 'present' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'certificates') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'cert-101',
                  certificate_number: 'CC-202611-PERFECT',
                  issued_at: '2026-11-01T00:00:00Z',
                },
                error: null,
              }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    });

    const res = await verifyCertificateEligibility(studentId, cohortId);

    // Assert that the student gets 100% attendance (3 out of 3 sessions)
    // rather than being deflated by the 17 global webinars or 5 pre-enrollment sessions!
    expect(res.eligible).toBe(true);
    expect(res.total_sessions).toBe(3);
    expect(res.attended_sessions).toBe(3);
    expect(res.attendance_rate_pct).toBe(100);
    expect(res.certificate_number).toBe('CC-202611-PERFECT');
  });

  it('calculates 100% attendance in getStudentUnifiedProgress and passes attendance gate', async () => {
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { code: '42883', message: 'RPC not found' },
    });

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    user_id: studentId,
                    cohort_id: cohortId,
                    status: 'enrolled',
                    enrolled_at: enrollmentDate,
                    created_at: enrollmentDate,
                  },
                  error: null,
                }),
              }),
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ cohort_id: cohortId, status: 'enrolled', created_at: enrollmentDate }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'cohorts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { sprint_duration_days: 7 },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'live_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [
                  { id: 's-valid-1', cohort_id: cohortId, starts_at: '2026-09-20T10:00:00Z' },
                  { id: 's-valid-2', cohort_id: cohortId, starts_at: '2026-09-27T10:00:00Z' },
                  { id: 's-pre-1', cohort_id: cohortId, starts_at: '2026-08-01T10:00:00Z' },
                  { id: 's-global-1', cohort_id: null, starts_at: '2026-07-01T10:00:00Z' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'session_attendance') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [
                    { session_id: 's-valid-1', status: 'present' },
                    { session_id: 's-valid-2', status: 'present' },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'modules') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'm-1', lessons: [{ id: 'l-1' }] }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'lesson_progress') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ lesson_id: 'l-1', completed: true }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'assignments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'a-1' }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'submissions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ assignment_id: 'a-1', status: 'approved' }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'daily_challenges') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'dc-1', day_number: 1 }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'daily_challenge_submissions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ challenge_id: 'dc-1', status: 'accepted', score: 95 }],
              error: null,
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    });

    const progress = await getStudentUnifiedProgress(studentId, cohortId);

    // Attendance is 2 out of 2 valid post-enrollment cohort sessions = 100%
    expect(progress.attendance).toBeDefined();
    expect(progress.attendance?.total_sessions).toBe(2);
    expect(progress.attendance?.attended_sessions).toBe(2);
    expect(progress.attendance?.attendance_rate_pct).toBe(100);
    expect(progress.attendance?.is_passed).toBe(true);
  });

  it('excludes global webinars from generateInternshipReport attendance calculation', async () => {
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { code: '42883', message: 'RPC get_internship_report not found' },
    });

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'cohorts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { name: 'Masterclass Cohort', sprint_duration_days: 7 },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { full_name: 'Sarah Connor', email: 'sarah@example.com' },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { enrolled_at: enrollmentDate, created_at: enrollmentDate },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'live_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [
                  { id: 'sess-1', cohort_id: cohortId, starts_at: '2026-09-20T10:00:00Z' },
                  { id: 'sess-global', cohort_id: null, starts_at: '2026-09-22T10:00:00Z' },
                  { id: 'sess-old', cohort_id: cohortId, starts_at: '2026-08-01T10:00:00Z' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'session_attendance') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ session_id: 'sess-1', status: 'present' }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'daily_challenges') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ id: 'd-1', day_number: 1, title: 'Speed Cutting' }],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'daily_challenge_submissions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ challenge_id: 'd-1', status: 'accepted', score: 90 }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'modules') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'm-1', lessons: [{ id: 'l-1' }] }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'lesson_progress') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ lesson_id: 'l-1', completed: true, watch_percentage: 100 }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'assignments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'a-1' }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'submissions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ assignment_id: 'a-1', status: 'approved' }],
              error: null,
            }),
          }),
        };
      }

      if (table === 'internship_reports') {
        const mockReportData = {
          id: 'report-101',
          cohort_id: cohortId,
          student_id: studentId,
          status: 'approved',
          composite_score: 95,
          grade: 'A+',
          attendance_rate_pct: 100,
          completed_drills_count: 1,
          total_drills_count: 1,
          technical_rating: 5,
          consistency_rating: 5,
          creative_rating: 5,
          summary_notes: 'Outstanding technical discipline',
          lor_eligible: true,
          telemetry_snapshot: {},
          generated_at: '2026-11-01T00:00:00Z',
          updated_at: '2026-11-01T00:00:00Z',
        };
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockReportData,
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockReportData,
                error: null,
              }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    });

    const report = await generateInternshipReport(cohortId, studentId);

    // Attendance is 100% (1 out of 1 session), not 33%
    expect(report.attendance_rate_pct).toBe(100);
  });
});
