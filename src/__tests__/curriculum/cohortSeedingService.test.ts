import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  seedCohortDailyChallenges,
  listDailyChallenges,
  bulkImportDailyChallenges,
} from '../../lib/internshipService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Cohort Daily Challenges Service Suite (Pure Database-Driven)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Author-Managed Challenges: seedCohortDailyChallenges', () => {
    it('invokes ensure_cohort_daily_challenges RPC and returns authored challenges from database', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, count: 2, seeded: false },
        error: null,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'uuid-1', day_number: 1, title: 'Authored Day 1', cohort_id: 'c-1' },
                    { id: 'uuid-2', day_number: 2, title: 'Authored Day 2', cohort_id: 'c-1' },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const res = await seedCohortDailyChallenges('c-1');
      expect(supabase.rpc).toHaveBeenCalledWith('ensure_cohort_daily_challenges', {
        p_cohort_id: 'c-1',
      });
      expect(res).toHaveLength(2);
      expect(res[0].title).toBe('Authored Day 1');
      expect(res[1].title).toBe('Authored Day 2');
    });

    it('safely falls back to listing database challenges if RPC fails', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'RPC not available' },
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'uuid-video-1', day_number: 1, title: 'Custom Video Cut', cohort_id: 'cohort-video-1' },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const res = await seedCohortDailyChallenges('cohort-video-1');
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Custom Video Cut');
    });
  });

  describe('Pure Database Queries: listDailyChallenges', () => {
    it('returns empty array when challenges have not been uploaded by author', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [], // Empty DB table
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const list = await listDailyChallenges('cohort-empty');
      expect(list).toEqual([]);
    });

    it('returns authored challenges in day_number ascending order', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'c-1', day_number: 1, title: 'Day 1 Drill' },
                    { id: 'c-2', day_number: 2, title: 'Day 2 Drill' },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const list = await listDailyChallenges('cohort-with-drills');
      expect(list).toHaveLength(2);
      expect(list[0].day_number).toBe(1);
      expect(list[1].day_number).toBe(2);
    });
  });

  describe('Author Bulk Import Studio: bulkImportDailyChallenges', () => {
    it('validates and inserts author-created challenges into database', async () => {
      let insertedPayload: Array<Record<string, unknown>> = [];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'daily_challenges') {
          return {
            upsert: vi.fn().mockImplementation((payload) => {
              insertedPayload = payload;
              return {
                select: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: payload.map((p: Record<string, unknown>, idx: number) => ({
                      ...p,
                      id: `uuid-import-${idx + 1}`,
                    })),
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return { select: vi.fn() };
      });

      const imported = await bulkImportDailyChallenges('cohort-code-2', [
        {
          day_number: 1,
          title: 'Custom Sprint Day 1',
          description: 'Custom brief',
          track_type: 'coding',
          submission_type: 'github_pr',
          deadline_hours: 24,
        },
      ]);

      expect(imported).toHaveLength(1);
      expect(insertedPayload).toHaveLength(1);
      expect(insertedPayload[0].title).toBe('Custom Sprint Day 1');
      expect(insertedPayload[0].cohort_id).toBe('cohort-code-2');
    });

    it('rejects empty payload or missing cohortId', async () => {
      await expect(bulkImportDailyChallenges('', [{ day_number: 1, title: 'T' }])).rejects.toThrow('Cohort ID is required');
      await expect(bulkImportDailyChallenges('c-1', [])).rejects.toThrow('No challenges provided');
    });
  });
});
