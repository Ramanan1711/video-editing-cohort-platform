import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPublicCertificate, verifyCertificateEligibility } from '../../lib/courseService';
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

describe('Authoritative Certificate Verification & Persistence Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPublicCertificate', () => {
    it('returns invalid if certificate number is blank or empty', async () => {
      const res = await getPublicCertificate('');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('valid certificate number');
    });

    it('returns authentic certificate data when authoritative RPC succeeds', async () => {
      const mockCertPayload = {
        valid: true,
        certificate_number: 'CC-202609-ABC123',
        student_id: 'student-uuid-1',
        student_name: 'Alex Rivera',
        cohort_id: 'cohort-uuid-1',
        cohort_name: 'Cinematic Editing Masterclass',
        issued_at: '2026-09-29T12:00:00Z',
        metadata: {
          total_lessons: 15,
          completed_lessons: 15,
          total_assignments: 4,
          approved_assignments: 4,
          total_challenges: 15,
          completed_challenges: 15,
          total_sessions: 4,
          attended_sessions: 4,
          attendance_rate_pct: 100.0,
          verified_by: 'system',
        },
      };

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: mockCertPayload,
        error: null,
      });

      const res = await getPublicCertificate('CC-202609-ABC123');

      expect(supabase.rpc).toHaveBeenCalledWith('verify_certificate_authenticity', {
        p_certificate_number: 'CC-202609-ABC123',
      });
      expect(res.valid).toBe(true);
      expect(res.certificate_number).toBe('CC-202609-ABC123');
      expect(res.student_name).toBe('Alex Rivera');
      expect(res.cohort_name).toBe('Cinematic Editing Masterclass');
      expect(res.metadata?.attendance_rate_pct).toBe(100.0);
    });

    it('falls back to database query when RPC is unavailable and returns verified certificate', async () => {
      // 1. RPC fails with not found error
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function not found' },
      });

      // 2. Direct query fallback
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'certificates') {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'cert-1',
                    certificate_number: 'CC-202609-FALLBACK99',
                    student_id: 'student-99',
                    cohort_id: 'cohort-99',
                    issued_at: '2026-09-28T10:00:00Z',
                    metadata: {
                      total_lessons: 10,
                      completed_lessons: 10,
                      total_assignments: 2,
                      approved_assignments: 2,
                      total_challenges: 15,
                      completed_challenges: 15,
                      total_sessions: 3,
                      attended_sessions: 3,
                      attendance_rate_pct: 100,
                    },
                  },
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
                  data: { full_name: 'Taylor Jordan' },
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
                  data: { name: 'Fall 2026 Documentary Cohort' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const res = await getPublicCertificate('CC-202609-FALLBACK99');

      expect(res.valid).toBe(true);
      expect(res.certificate_number).toBe('CC-202609-FALLBACK99');
      expect(res.student_name).toBe('Taylor Jordan');
      expect(res.cohort_name).toBe('Fall 2026 Documentary Cohort');
      expect(res.metadata?.completed_lessons).toBe(10);
    });

    it('returns valid: false when certificate number is not found in database', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function not found' },
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'certificates') {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await getPublicCertificate('CC-NONEXISTENT-NUMBER');

      expect(res.valid).toBe(false);
      expect(res.error).toContain('Certificate not found');
    });
  });

  describe('verifyCertificateEligibility fallback resilience', () => {
    it('refuses to return unpersisted certificate if database insertion fails', async () => {
      // RPC verify_and_issue_certificate unavailable
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'RPC not found' },
      });

      // Mocks for all 4 pillars passing, but certificates.insert fails (e.g. RLS or constraint error)
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'm1', lessons: [{ id: 'l1', video_url: 'https://v.io/1' }] }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ lesson_id: 'l1', completed: true, watch_percentage: 100 }],
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
                  data: [{ id: 'a1', title: 'Grad Project' }],
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
                  data: [{ assignment_id: 'a1', status: 'reviewed' }],
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
                  data: { sprint_duration_days: 1 },
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
                data: [{ id: 'dc1', day_number: 1 }],
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
                  data: [{ challenge_id: 'dc1', status: 'accepted' }],
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
                  data: [{ id: 'ls1', starts_at: '2026-09-01' }],
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
                in: vi.fn().mockResolvedValue({
                  data: [{ session_id: 'ls1', status: 'present' }],
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
            // Insert fails with database error!
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: '42501', message: 'permission denied for table certificates' },
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
      });

      const res = await verifyCertificateEligibility('student-insert-fail', 'cohort-1');

      // Crucial: Must NOT return eligible: true or invent a fake certificate number
      expect(res.eligible).toBe(false);
      expect(res.certificate_number).toBeUndefined();
      expect(res.reason).toContain('persistence failed');
    });
  });
});
