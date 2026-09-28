import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateSLA,
  RUBRIC_REVIEW_TEMPLATES,
  listDetailedMentorSubmissions,
  submitDetailedReview,
  getMentorDashboardStats,
} from '../../lib/mentorService';
import { supabase } from '../../lib/supabaseClient';
import { queryCache } from '../../lib/queryCache';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('Mentor Review, SLA & Scoping Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCache.clear();
  });

  describe('SLA Turnaround Calculation (calculateSLA)', () => {
    it('returns on_track for freshly submitted work (< 18 hours for 24h target)', () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
      const sla = calculateSLA(fiveHoursAgo, 24);
      expect(sla.status).toBe('on_track');
      expect(sla.waitingHours).toBeCloseTo(5, 0);
    });

    it('returns warning when submission has waited >= 75% of SLA target (e.g. 19 hours)', () => {
      const nineteenHoursAgo = new Date(Date.now() - 19 * 3600 * 1000).toISOString();
      const sla = calculateSLA(nineteenHoursAgo, 24);
      expect(sla.status).toBe('warning');
      expect(sla.waitingHours).toBeCloseTo(19, 0);
    });

    it('returns overdue when submission waiting time >= SLA target (e.g. 26 hours)', () => {
      const twentySixHoursAgo = new Date(Date.now() - 26 * 3600 * 1000).toISOString();
      const sla = calculateSLA(twentySixHoursAgo, 24);
      expect(sla.status).toBe('overdue');
      expect(sla.waitingHours).toBeCloseTo(26, 0);
    });

    it('gracefully handles missing createdAt string', () => {
      const sla = calculateSLA(undefined, 24);
      expect(sla.status).toBe('on_track');
      expect(sla.waitingHours).toBe(0);
    });
  });

  describe('Rubric Review Templates', () => {
    it('provides all 5 core post-production review templates', () => {
      expect(RUBRIC_REVIEW_TEMPLATES).toHaveLength(5);
      const ids = RUBRIC_REVIEW_TEMPLATES.map((t) => t.id);
      expect(ids).toEqual([
        'rough-cut',
        'pacing-rhythm',
        'sound-design',
        'color-grading',
        'picture-lock',
      ]);
    });

    it('enforces that all template rubric scores are between 1 and 5 across all 5 grading axes', () => {
      RUBRIC_REVIEW_TEMPLATES.forEach((template) => {
        const { storytelling, pacing, audio, color, technical } = template.scores;
        [storytelling, pacing, audio, color, technical].forEach((score) => {
          expect(score).toBeGreaterThanOrEqual(1);
          expect(score).toBeLessThanOrEqual(5);
        });
        expect(template.suggestedComments.length).toBeGreaterThan(15);
      });
    });
  });

  describe('Cohort-Scoped Submission Filtering', () => {
    it('restricts submissions to only the allowed cohort IDs assigned to the mentor', async () => {
      const mockMap = new Map([
        [
          'assign-cohort-1',
          {
            assignmentId: 'assign-cohort-1',
            assignmentTitle: 'Documentary Rough Cut',
            assignmentInstructions: 'Assemble scenes 1-4',
            assignmentDeadline: '2026-10-01',
            cohortId: 'cohort-allowed-1',
            cohortName: 'Pro Editing Cohort Alpha',
          },
        ],
        [
          'assign-cohort-2',
          {
            assignmentId: 'assign-cohort-2',
            assignmentTitle: 'Commercial Color Grade',
            assignmentInstructions: 'Grade RED raw footage',
            assignmentDeadline: '2026-10-05',
            cohortId: 'cohort-unauthorized-2',
            cohortName: 'Color Mastery Cohort Beta',
          },
        ],
      ]);

      queryCache.set('assignment_cohort_map', mockMap, 600000);

      const mockSubmissions = [
        {
          id: 'sub-1',
          assignment_id: 'assign-cohort-1',
          student_id: 'student-1',
          file_url: 'https://cdn.cutcraft.test/cuts/sub1.mp4',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'sub-2',
          assignment_id: 'assign-cohort-2',
          student_id: 'student-2',
          file_url: 'https://cdn.cutcraft.test/cuts/sub2.mp4',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                in: vi.fn().mockImplementation((_field: string, ids: string[]) => {
                  const filtered = mockSubmissions.filter((s) => ids.includes(s.assignment_id));
                  return Promise.resolve({ data: filtered, error: null });
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'student-1', full_name: 'Alice Student', email: 'alice@test.com' },
                  { id: 'student-2', full_name: 'Bob Student', email: 'bob@test.com' },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'feedback') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

      const results = await listDetailedMentorSubmissions(['cohort-allowed-1']);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('sub-1');
      expect(results[0].assignment_id).toBe('assign-cohort-1');
      expect(results[0].cohort_name).toBe('Pro Editing Cohort Alpha');
    });

    it('returns empty list when mentor is assigned no cohorts', async () => {
      queryCache.set('assignment_cohort_map', new Map(), 600000);

      const results = await listDetailedMentorSubmissions([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('Submit Review & Feedback Insertion', () => {
    it('executes review_submission_v2 RPC with rubric scores and comments', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      });

      await submitDetailedReview(
        'sub-1',
        'reviewed',
        'Solid cut! Approved.',
        { storytelling: 5, pacing: 4, audio: 4, color: 4, technical: 5 }
      );

      expect(supabase.rpc).toHaveBeenCalledWith('review_submission_v2', {
        p_submission_id: 'sub-1',
        p_status: 'reviewed',
        p_comments: 'Solid cut! Approved.',
        p_rubric: { storytelling: 5, pacing: 4, audio: 4, color: 4, technical: 5 },
        p_timestamped_notes: [],
        p_private_notes: null,
      });
    });

    it('falls back to review_submission RPC when review_submission_v2 fails', async () => {
      const mockRpc = vi.fn().mockImplementation((fnName: string) => {
        if (fnName === 'review_submission_v2') {
          return Promise.resolve({ data: null, error: new Error('Function not found') });
        }
        if (fnName === 'review_submission') {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockRpc);
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

      await submitDetailedReview(
        'sub-2',
        'resubmit',
        'Pacing drags in scene 3; trim by 8 seconds.',
        undefined,
        [],
        'Keep eye on student progress.'
      );

      expect(mockRpc).toHaveBeenCalledWith('review_submission_v2', expect.any(Object));
      expect(mockRpc).toHaveBeenCalledWith('review_submission', {
        p_submission_id: 'sub-2',
        p_status: 'resubmit',
        p_comments: 'Pacing drags in scene 3; trim by 8 seconds.',
      });
    });

    it('falls back to direct table inserts when both review_submission_v2 and review_submission are missing', async () => {
      const mockRpc = vi.fn().mockImplementation(() =>
        Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'function does not exist' } })
      );
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockRpc);

      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'feedback') {
          return { insert: mockInsert };
        }
        if (table === 'submissions') {
          return { update: mockUpdate };
        }
        return {};
      });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

      (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: { id: 'mentor-1' } },
        error: null,
      });

      await submitDetailedReview(
        'sub-3',
        'reviewed',
        'Approved via direct fallback.',
        { storytelling: 5, pacing: 5, audio: 5, color: 5, technical: 5 }
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          submission_id: 'sub-3',
          mentor_id: 'mentor-1',
          comment: 'Approved via direct fallback.',
        })
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'reviewed',
        })
      );
    });
  });

  describe('Mentor Dashboard Honest KPIs & Zero-State Metrics', () => {
    it('returns honest zero-state stats without fabricated rubric fallbacks for unassigned mentors', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'mentor_cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

      const stats = await getMentorDashboardStats('mentor-empty-1', 'mentor');

      expect(stats.avgResponseHours).toBeNull();
      expect(stats.skillDistribution).toBeDefined();
      expect(stats.skillDistribution!.total_graded_reviews).toBe(0);
      expect(stats.skillDistribution!.storytelling).toBe(0);
      expect(stats.skillDistribution!.pacing).toBe(0);
      expect(stats.skillDistribution!.audio).toBe(0);
      expect(stats.skillDistribution!.color).toBe(0);
      expect(stats.skillDistribution!.technical).toBe(0);
      expect(stats.skillDistribution!.overall_average).toBe(0);
      expect(stats.skillDistribution!.lowest_skill_area).toBe('None');
    });
  });
});

