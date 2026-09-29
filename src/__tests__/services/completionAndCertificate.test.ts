import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyCertificateEligibility, getStudentUnifiedProgress } from '../../lib/courseService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('Authoritative Completion & Certificate Eligibility Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyCertificateEligibility via RPC', () => {
    it('returns authoritative 4-pillar eligibility when verify_and_issue_certificate RPC succeeds', async () => {
      const mockResult = {
        eligible: true,
        already_issued: false,
        certificate_number: 'CC-202609-XYZ123',
        issued_at: '2026-09-29T12:00:00Z',
        completed_lessons: 12,
        total_lessons: 12,
        approved_assignments: 3,
        total_assignments: 3,
        completed_challenges: 15,
        total_challenges: 15,
        attended_sessions: 4,
        total_sessions: 4,
        attendance_rate_pct: 100.0,
        min_attendance_pct: 75.0,
      };

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: mockResult,
        error: null,
      });

      const res = await verifyCertificateEligibility('student-1', 'cohort-1');

      expect(supabase.rpc).toHaveBeenCalledWith('verify_and_issue_certificate', {
        p_student_id: 'student-1',
        p_cohort_id: 'cohort-1',
      });
      expect(res.eligible).toBe(true);
      expect(res.certificate_number).toBe('CC-202609-XYZ123');
      expect(res.completed_challenges).toBe(15);
      expect(res.attended_sessions).toBe(4);
      expect(res.attendance_rate_pct).toBe(100.0);
    });

    it('returns ineligibility reason if RPC rejects due to low attendance', async () => {
      const mockReject = {
        eligible: false,
        reason: 'Workshop attendance is 50% (2 of 4 sessions attended). Minimum 75% live session attendance is required.',
        completed_lessons: 12,
        total_lessons: 12,
        approved_assignments: 3,
        total_assignments: 3,
        completed_challenges: 15,
        total_challenges: 15,
        attended_sessions: 2,
        total_sessions: 4,
        attendance_rate_pct: 50.0,
        min_attendance_pct: 75.0,
      };

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: mockReject,
        error: null,
      });

      const res = await verifyCertificateEligibility('student-low-att', 'cohort-1');

      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('Workshop attendance is 50%');
      expect(res.attendance_rate_pct).toBe(50.0);
    });
  });

  describe('verifyCertificateEligibility client-side fallback (4-pillar gate)', () => {
    const setupFallbackMocks = ({
      lessonsComplete = true,
      assignsComplete = true,
      challengesComplete = true,
      attendanceRate = 100,
      hasHeldSessions = true,
    } = {}) => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function verify_and_issue_certificate does not exist' },
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'm1',
                    lessons: [{ id: 'l1', video_url: 'https://video.test/1' }],
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
                data: [
                  {
                    lesson_id: 'l1',
                    completed: lessonsComplete,
                    watch_percentage: lessonsComplete ? 100 : 30,
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: 'a1', title: 'Cap 1' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: assignsComplete ? [{ assignment_id: 'a1', status: 'reviewed' }] : [],
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
                  data: { sprint_duration_days: 2 },
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
                  { id: 'dc1', day_number: 1 },
                  { id: 'dc2', day_number: 2 },
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
                  data: challengesComplete
                    ? [{ challenge_id: 'dc1', status: 'accepted' }, { challenge_id: 'dc2', status: 'accepted' }]
                    : [{ challenge_id: 'dc1', status: 'accepted' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'live_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({
                  data: hasHeldSessions
                    ? [{ id: 'ls1', starts_at: '2026-09-01' }, { id: 'ls2', starts_at: '2026-09-02' }]
                    : [],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'session_attendance') {
          const attendedRows = hasHeldSessions && attendanceRate >= 75
            ? [{ session_id: 'ls1', status: 'present' }, { session_id: 'ls2', status: 'late' }]
            : hasHeldSessions && attendanceRate < 75
            ? [{ session_id: 'ls1', status: 'present' }]
            : [];

          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: attendedRows,
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
                    id: 'cert-1',
                    certificate_number: 'CC-202609-FALLBACK',
                    issued_at: '2026-09-29T12:00:00Z',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'enrollments') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });
    };

    it('blocks certification when sprint challenges are incomplete', async () => {
      setupFallbackMocks({ challengesComplete: false });

      const res = await verifyCertificateEligibility('student-ch-fail', 'cohort-1');

      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('sprint challenge(s) not completed or accepted');
      expect(res.completed_challenges).toBe(1);
      expect(res.total_challenges).toBe(2);
    });

    it('blocks certification when workshop attendance is below 75%', async () => {
      setupFallbackMocks({ attendanceRate: 50 }); // 1 of 2 attended = 50%

      const res = await verifyCertificateEligibility('student-att-fail', 'cohort-1');

      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('attendance is 50%');
      expect(res.attended_sessions).toBe(1);
      expect(res.total_sessions).toBe(2);
      expect(res.attendance_rate_pct).toBe(50);
    });

    it('issues certificate when all 4 pillars are fully met', async () => {
      setupFallbackMocks({
        lessonsComplete: true,
        assignsComplete: true,
        challengesComplete: true,
        attendanceRate: 100,
      });

      const res = await verifyCertificateEligibility('student-graduating', 'cohort-1');

      expect(res.eligible).toBe(true);
      expect(res.certificate_number).toBe('CC-202609-FALLBACK');
      expect(res.completed_lessons).toBe(1);
      expect(res.approved_assignments).toBe(1);
      expect(res.completed_challenges).toBe(2);
      expect(res.attended_sessions).toBe(2);
      expect(res.attendance_rate_pct).toBe(100);
    });

    it('grants eligibility when no live sessions were scheduled (exempt) and all curriculum+challenges pass', async () => {
      setupFallbackMocks({
        lessonsComplete: true,
        assignsComplete: true,
        challengesComplete: true,
        hasHeldSessions: false,
      });

      const res = await verifyCertificateEligibility('student-no-sessions', 'cohort-1');

      expect(res.eligible).toBe(true);
      expect(res.total_sessions).toBe(0);
      expect(res.attendance_rate_pct).toBe(100);
    });
  });

  describe('getStudentUnifiedProgress attendance telemetry', () => {
    it('returns attendance block and gates certificate eligibility on attendance', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'RPC not found' },
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [{ cohort_id: 'c-test', status: 'enrolled', created_at: '2026-01-01' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              if (cols.includes('sprint_duration_days')) {
                return {
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { sprint_duration_days: 10 },
                      error: null,
                    }),
                  }),
                };
              }
              return {
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [{ id: 'c-test', title: 'Test Cohort' }],
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === 'modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'm1',
                      lessons: [{ id: 'l1', status: 'published' }],
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ lesson_id: 'l1', completed: true }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'daily_challenge_submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'live_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({
                  data: [{ id: 's1' }, { id: 's2' }],
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
                    data: [{ session_id: 's1' }], // 1 of 2 = 50%
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const progress = await getStudentUnifiedProgress('user-att', 'c-test');

      expect(progress.attendance).toBeDefined();
      expect(progress.attendance?.total_sessions).toBe(2);
      expect(progress.attendance?.attended_sessions).toBe(1);
      expect(progress.attendance?.attendance_rate_pct).toBe(50);
      expect(progress.attendance?.is_passed).toBe(false);
      // Because attendance failed (<75%), certificate eligibility must be false
      expect(progress.overall.eligible_for_certificate).toBe(false);
    });
  });
});
