import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import { verifyCertificateEligibility } from '../../lib/services/certificateService';
import { getStudentSprintDays, listCohortInternsMonitoring } from '../../lib/internshipService';

describe('Issue 2: Sprint Drill Denominator Mismatch (Default 15 vs Actual Authored Drills)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('certificateService.verifyCertificateEligibility', () => {
    it('bounds required challenges to 7 when mentor authors 7 challenges and sprint_duration_days is unset (null)', async () => {
      // Mock RPC error to trigger client-side fallback logic
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'Function not found' },
      } as any);

      const authoredChallenges = Array.from({ length: 7 }, (_, i) => ({
        id: `challenge-${i + 1}`,
        day_number: i + 1,
      }));

      const acceptedSubmissions = authoredChallenges.map((c) => ({
        challenge_id: c.id,
        status: 'accepted',
      }));

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
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
                    certificate_number: 'CC-202611-ABC123',
                    issued_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { enrolled_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z' },
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
          } as any;
        }

        if (table === 'modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'mod-1', lessons: [{ id: 'les-1', video_url: 'https://example.com/v.mp4' }] }],
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ lesson_id: 'les-1', completed: true, watch_percentage: 100 }],
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: 'assign-1', title: 'Grad Project' }],
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ assignment_id: 'assign-1', status: 'reviewed' }],
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                // sprint_duration_days is unset / null in cohort table
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { sprint_duration_days: null },
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: authoredChallenges,
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'daily_challenge_submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: acceptedSubmissions,
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'live_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({
                  data: [{ id: 'session-1', cohort_id: 'cohort-1', starts_at: '2026-09-02T00:00:00Z' }],
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'session_attendance') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ session_id: 'session-1', status: 'present' }],
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() } as any;
      });

      const result = await verifyCertificateEligibility('student-1', 'cohort-1');

      // Must be eligible because all 7 authored challenges are completed
      expect(result.eligible).toBe(true);
      expect(result.total_challenges).toBe(7);
      expect(result.completed_challenges).toBe(7);
    });

    it('bounds required challenges to 7 even if cohort sprint_duration_days defaults to 15 in database', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'Function not found' },
      } as any);

      const authoredChallenges = Array.from({ length: 7 }, (_, i) => ({
        id: `challenge-${i + 1}`,
        day_number: i + 1,
      }));

      // Student completed 5 of the 7 authored challenges
      const acceptedSubmissions = authoredChallenges.slice(0, 5).map((c) => ({
        challenge_id: c.id,
        status: 'accepted',
      }));

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'certificates') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          } as any;
        }

        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { enrolled_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z' },
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }

        if (table === 'modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'mod-1', lessons: [{ id: 'les-1', video_url: 'https://example.com/v.mp4' }] }],
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ lesson_id: 'les-1', completed: true, watch_percentage: 100 }],
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: 'assign-1', title: 'Grad Project' }],
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ assignment_id: 'assign-1', status: 'reviewed' }],
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                // Database duration was defaulted to 15, but only 7 challenges exist
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { sprint_duration_days: 15 },
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: authoredChallenges,
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'daily_challenge_submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: acceptedSubmissions,
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'live_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({
                  data: [{ id: 'session-1', cohort_id: 'cohort-1', starts_at: '2026-09-02T00:00:00Z' }],
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'session_attendance') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ session_id: 'session-1', status: 'present' }],
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() } as any;
      });

      const result = await verifyCertificateEligibility('student-1', 'cohort-1');

      expect(result.eligible).toBe(false);
      expect(result.total_challenges).toBe(7); // Must NOT be 15
      expect(result.completed_challenges).toBe(5);
      // Explains that 2 challenges remain (7 - 5), NOT 10 remaining (15 - 5)
      expect(result.reason).toContain('2 sprint challenge(s) not completed or accepted');
    });
  });

  describe('internshipService.getStudentSprintDays', () => {
    it('sets totalDays to 7 when mentor authors 7 challenges and cohortMeta sprint_duration_days is unset (null)', async () => {
      const authoredChallenges = Array.from({ length: 7 }, (_, i) => ({
        id: `challenge-${i + 1}`,
        day_number: i + 1,
        title: `Day ${i + 1} Drill`,
        description: `Description ${i + 1}`,
        is_published: true,
      }));

      const acceptedSubmissions = authoredChallenges.map((c) => ({
        id: `sub-${c.id}`,
        challenge_id: c.id,
        user_id: 'student-1',
        status: 'accepted' as const,
        submitted_at: new Date().toISOString(),
        score: 90,
      }));

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { sprint_duration_days: null, start_date: '2026-09-01', timezone: 'Asia/Kolkata' },
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: authoredChallenges,
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'daily_challenge_submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: acceptedSubmissions,
                error: null,
              }),
            }),
          } as any;
        }

        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() } as any;
      });

      const sprintData = await getStudentSprintDays('student-1', 'cohort-1');

      expect(sprintData.totalDays).toBe(7);
      expect(sprintData.completedCount).toBe(7);
      expect(sprintData.progressPercent).toBe(100);
      expect(sprintData.days.length).toBe(7);
    });
  });

  describe('internshipService.listCohortInternsMonitoring', () => {
    it('bounds monitoring roster totalDays to 7 authored challenges when configuredDays is undefined', async () => {
      const authoredChallenges = Array.from({ length: 7 }, (_, i) => ({
        id: `challenge-${i + 1}`,
        day_number: i + 1,
      }));

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { sprint_duration_days: null },
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    user_id: 'student-1',
                    status: 'enrolled',
                    created_at: '2026-09-01',
                    profiles: {
                      id: 'student-1',
                      full_name: 'John Doe',
                      email: 'john@example.com',
                    },
                  },
                ],
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: authoredChallenges,
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'daily_challenge_submissions') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'sub-1',
                    challenge_id: 'challenge-1',
                    user_id: 'student-1',
                    status: 'accepted',
                  },
                ],
                error: null,
              }),
            }),
          } as any;
        }

        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() } as any;
      });

      const roster = await listCohortInternsMonitoring('cohort-1');

      expect(roster.length).toBe(1);
      // Roster days dictionary must only contain days 1..7, not 1..15
      const days = Object.keys(roster[0].dayStatuses);
      expect(days.length).toBe(7);
      expect(days).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    });
  });
});
