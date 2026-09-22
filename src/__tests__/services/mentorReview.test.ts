import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateSLA,
  RUBRIC_REVIEW_TEMPLATES,
  listDetailedMentorSubmissions,
  submitDetailedReview,
} from '../../lib/mentorService';
import { supabase } from '../../lib/supabaseClient';
import { queryCache } from '../../lib/queryCache';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
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
  });
});
