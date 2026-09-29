import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStudentUnifiedProgress } from '../../lib/courseService';
import { getStudentSprintDays, listCohortInternsMonitoring } from '../../lib/internshipService';
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

describe('Unified Progress Tracking & Dynamic Sprint Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStudentUnifiedProgress', () => {
    it('returns authoritative progress when get_student_unified_progress RPC succeeds', async () => {
      const mockRpcProgress = {
        curriculum: {
          total_lessons: 10,
          completed_lessons: 8,
          percent: 80,
          total_watch_seconds: 3600,
        },
        assignments: {
          total_assignments: 4,
          submitted_assignments: 3,
          approved_assignments: 2,
          percent: 50,
        },
        sprint_challenges: {
          configured_sprint_days: 20,
          effective_sprint_days: 20,
          total_challenges: 20,
          submitted_challenges: 15,
          completed_challenges: 14,
          percent: 70,
          streak_days: 14,
          average_score: 92,
        },
        overall: {
          composite_percent: 71,
          total_milestones: 34,
          completed_milestones: 24,
          is_completed: false,
          eligible_for_certificate: false,
          has_certificate: false,
        },
      };

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: mockRpcProgress,
        error: null,
      });

      const result = await getStudentUnifiedProgress('student-1', 'cohort-1');

      expect(supabase.rpc).toHaveBeenCalledWith('get_student_unified_progress', {
        p_student_id: 'student-1',
        p_cohort_id: 'cohort-1',
      });
      expect(result).toEqual(mockRpcProgress);
      expect(result.overall.composite_percent).toBe(71);
      expect(result.sprint_challenges.effective_sprint_days).toBe(20);
    });

    it('falls back to client-side multi-table aggregation when RPC fails', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function get_student_unified_progress does not exist' },
      });

      // Mock from() chains for fallback queries
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [{ cohort_id: 'cohort-fallback', status: 'enrolled', created_at: '2026-01-01' }],
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
                      data: { sprint_duration_days: 12 },
                      error: null,
                    }),
                  }),
                };
              }
              return {
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [{ id: 'cohort-fallback', title: 'Fallback Cohort', description: 'Test' }],
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
                      title: 'Module 1',
                      position: 1,
                      cohort_id: 'cohort-fallback',
                      lessons: [
                        { id: 'l1', title: 'Lesson 1', position: 1, status: 'published' },
                        { id: 'l2', title: 'Lesson 2', position: 2, status: 'published' },
                      ],
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
                data: [
                  { lesson_id: 'l1', completed: true, watch_percentage: 100, last_position_seconds: 120 },
                  { lesson_id: 'l2', completed: false, watch_percentage: 40, last_position_seconds: 40 },
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
                  data: [
                    { id: 'a1', title: 'Assignment 1', cohort_id: 'cohort-fallback' },
                    { id: 'a2', title: 'Assignment 2', cohort_id: 'cohort-fallback' },
                  ],
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
                  data: [
                    { assignment_id: 'a1', status: 'reviewed' },
                    { assignment_id: 'a2', status: 'submitted' },
                  ],
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
                  data: [
                    { id: 'c1', day_number: 1, title: 'Day 1' },
                    { id: 'c2', day_number: 2, title: 'Day 2' },
                    { id: 'c3', day_number: 3, title: 'Day 3' },
                  ],
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
                data: [
                  { id: 'sub-c1', challenge_id: 'c1', status: 'accepted', score: 95 },
                  { id: 'sub-c2', challenge_id: 'c2', status: 'accepted', score: 85 },
                ],
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

      const result = await getStudentUnifiedProgress('student-fallback', 'cohort-fallback');

      expect(result).toBeDefined();
      expect(result.curriculum.total_lessons).toBe(2);
      expect(result.curriculum.completed_lessons).toBe(1);
      expect(result.curriculum.percent).toBe(50);

      expect(result.assignments.total_assignments).toBe(2);
      expect(result.assignments.submitted_assignments).toBe(2);
      expect(result.assignments.approved_assignments).toBe(1);
      expect(result.assignments.percent).toBe(50);

      expect(result.sprint_challenges.configured_sprint_days).toBe(12);
      expect(result.sprint_challenges.completed_challenges).toBe(2);
      expect(result.sprint_challenges.average_score).toBe(90);

      // Total milestones = 2 lessons + 2 assignments + 12 sprint days = 16 milestones
      // Completed milestones = 1 lesson + 1 approved assignment + 2 completed challenges = 4
      expect(result.overall.total_milestones).toBe(16);
      expect(result.overall.completed_milestones).toBe(4);
      expect(result.overall.composite_percent).toBe(25);
    });
  });

  describe('getStudentSprintDays with dynamic duration', () => {
    it('uses custom cohort sprint duration instead of hardcoded 15 days', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
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
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'ch-1', day_number: 1, title: 'Day 1' },
                    { id: 'ch-2', day_number: 2, title: 'Day 2' },
                    { id: 'ch-3', day_number: 3, title: 'Day 3' },
                  ],
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
                data: [
                  { id: 'sub-1', challenge_id: 'ch-1', status: 'accepted', score: 100 },
                  { id: 'sub-2', challenge_id: 'ch-2', status: 'accepted', score: 90 },
                ],
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

      const res = await getStudentSprintDays('user-dynamic', 'cohort-7d');

      expect(res.totalDays).toBe(7);
      expect(res.days.length).toBe(7);
      expect(res.completedCount).toBe(2);
      expect(res.streakCount).toBe(2);
      expect(res.overallScore).toBe(95);
      expect(res.progressPercent).toBe(Math.round((2 / 7) * 100)); // 29%
    });

    it('expands totalDays if challenge day_number exceeds configured duration', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { sprint_duration_days: 10 },
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
                  data: [
                    { id: 'ch-1', day_number: 1, title: 'Day 1' },
                    { id: 'ch-12', day_number: 12, title: 'Day 12 Capstone' },
                  ],
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
                data: [],
                error: null,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const res = await getStudentSprintDays('user-exceed', 'cohort-expand');
      expect(res.totalDays).toBe(12);
      expect(res.days.length).toBe(12);
    });
  });

  describe('listCohortInternsMonitoring', () => {
    it('calculates risk telemetry dynamically based on cohort totalDays', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { sprint_duration_days: 10 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    user_id: 'intern-1',
                    status: 'active',
                    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
                    profiles: {
                      id: 'intern-1',
                      full_name: 'Intern One',
                      email: 'intern1@example.com',
                      whatsapp_number: '+1234567890',
                      whatsapp_opt_in: true,
                    },
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'c1', day_number: 1 },
                  { id: 'c2', day_number: 2 },
                  { id: 'c3', day_number: 3 },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'daily_challenge_submissions') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { challenge_id: 'c1', user_id: 'intern-1', status: 'accepted', score: 90 },
                ],
                error: null,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const interns = await listCohortInternsMonitoring('cohort-10d');

      expect(interns.length).toBe(1);
      expect(interns[0].totalDays).toBe(10);
      expect(interns[0].completedDaysCount).toBe(1);
      expect(interns[0].completionPercentage).toBe(10);
    });
  });
});
