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

describe('Domain-Aware Cohort Daily Challenges Seeding Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Client Fallback: seedCohortDailyChallenges', () => {
    it('seeds the Full-Stack Coding syllabus for coding cohorts', async () => {
      // Mock RPC failure to test fallback logic
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'RPC not deployed' },
      });

      let insertedPayload: Array<Record<string, unknown>> = [];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'cohort-coding-1',
                    title: 'Full Stack Python & React Engineering',
                    name: 'Full Stack Python & React Engineering',
                    track_type: 'coding',
                    course_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'daily_challenges') {
          return {
            upsert: vi.fn().mockImplementation((payload) => {
              insertedPayload = payload;
              return {
                select: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: payload.map((p: Record<string, unknown>, idx: number) => ({
                      ...p,
                      id: `uuid-challenge-${idx + 1}`,
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

      const seeded = await seedCohortDailyChallenges('cohort-coding-1');
      expect(seeded).toHaveLength(15);
      expect(insertedPayload).toHaveLength(15);
      expect(insertedPayload[0].title).toBe('Day 01: Git Workflow, Dev Environment & Initial Commit');
      expect(insertedPayload[0].track_type).toBe('coding');
      expect(insertedPayload[0].submission_type).toBe('github_pr');
      expect(insertedPayload[1].title).toBe('Day 02: Relational Modeling & Row-Level Security (RLS)');
    });

    it('seeds the Motion Graphics syllabus for motion/3D cohorts', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'RPC unavailable' },
      });

      let insertedPayload: Array<Record<string, unknown>> = [];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'cohort-motion-1',
                    title: 'Cinema 4D & Blender 3D Motion Cohort',
                    name: 'Cinema 4D & Blender 3D Motion Cohort',
                    track_type: 'non_coding',
                    course_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'daily_challenges') {
          return {
            upsert: vi.fn().mockImplementation((payload) => {
              insertedPayload = payload;
              return {
                select: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: payload.map((p: Record<string, unknown>, idx: number) => ({
                      ...p,
                      id: `uuid-motion-${idx + 1}`,
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

      const seeded = await seedCohortDailyChallenges('cohort-motion-1');
      expect(seeded).toHaveLength(15);
      expect(insertedPayload).toHaveLength(15);
      expect(insertedPayload[0].title).toBe('Day 01: Workspace Setup, Keyframe Curves & Velocity');
      expect(insertedPayload[0].track_type).toBe('non_coding');
      expect(insertedPayload[1].title).toBe('Day 02: Kinetic Typography & Expression-Driven Titles');
      expect(insertedPayload[5].title).toBe('Day 06: Cinema 4D / Blender Integration & 3D Camera Tracking');
    });

    it('seeds the Video Editing syllabus by default for video editing cohorts', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'RPC unavailable' },
      });

      let insertedPayload: Array<Record<string, unknown>> = [];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'cohort-video-1',
                    title: 'Premiere Pro Commercial Editing',
                    name: 'Premiere Pro Commercial Editing',
                    track_type: 'non_coding',
                    course_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'daily_challenges') {
          return {
            upsert: vi.fn().mockImplementation((payload) => {
              insertedPayload = payload;
              return {
                select: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: payload.map((p: Record<string, unknown>, idx: number) => ({
                      ...p,
                      id: `uuid-video-${idx + 1}`,
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

      const seeded = await seedCohortDailyChallenges('cohort-video-1');
      expect(seeded).toHaveLength(15);
      expect(insertedPayload).toHaveLength(15);
      expect(insertedPayload[0].title).toContain('Production Setup & First Kinetic Cut');
      expect(insertedPayload[2].title).toContain('Sound Design, SFX Stems & Audio Layering');
    });

    it('listDailyChallenges returns empty array when challenges are not configured (pure database-driven)', async () => {
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

      const list = await listDailyChallenges('cohort-code-2');
      expect(list).toEqual([]);
    });

    it('bulkImportDailyChallenges validates and inserts challenges into database', async () => {
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
  });

  describe('Database Seeding RPC Integration', () => {
    it('uses ensure_cohort_daily_challenges RPC when available', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, count: 15, seeded: true, track: 'coding' },
        error: null,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'rpc-ch-1',
                  cohort_id: 'c-rpc-1',
                  day_number: 1,
                  title: 'Day 01: Git Workflow, Dev Environment & Initial Commit',
                  track_type: 'coding',
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const res = await seedCohortDailyChallenges('c-rpc-1');
      expect(supabase.rpc).toHaveBeenCalledWith('ensure_cohort_daily_challenges', {
        p_cohort_id: 'c-rpc-1',
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('rpc-ch-1');
    });
  });
});
