import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatWhatsAppChallengeMessage,
  formatWhatsAppWorkshopAlert,
  formatWhatsAppInactivityNudge,
  formatWhatsAppFeedbackAlert,
  generateWhatsAppClickToChatUrl,
} from '../../lib/whatsappService';
import {
  DEFAULT_15_DAY_CURRICULUM,
  getStudentSprintDays,
  submitDailyChallenge,
  listDailyChallenges,
  createDailyChallenge,
  updateDailyChallenge,
  deleteDailyChallenge,
  seedCohortDailyChallenges,
  unlockScheduledDailyChallenges,
  unlockCohortDailyChallenges,
  setDailyChallengePublicationStatus,
} from '../../lib/internshipService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('15-Day Internship Platform & WhatsApp Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('has 15 curated daily challenges in the default curriculum', () => {
    expect(DEFAULT_15_DAY_CURRICULUM).toHaveLength(15);
    expect(DEFAULT_15_DAY_CURRICULUM[0].day_number).toBe(1);
    expect(DEFAULT_15_DAY_CURRICULUM[14].day_number).toBe(15);

    // Verify all days 1 to 15 exist in order
    for (let day = 1; day <= 15; day++) {
      const ch = DEFAULT_15_DAY_CURRICULUM.find((c) => c.day_number === day);
      expect(ch).toBeDefined();
      expect(ch?.title).toContain(`Day ${day.toString().padStart(2, '0')}`);
      expect(ch?.deadline_hours).toBeGreaterThanOrEqual(24);
    }
  });

  it('generates direct WhatsApp click-to-chat URLs with sanitized numbers and encoded parameters', () => {
    const phone = '+91 98765-43210';
    const text = 'Hello Mentor! I need help with Day 03 challenge.';
    const url = generateWhatsAppClickToChatUrl(phone, text);

    expect(url).toContain('https://wa.me/919876543210?text=');
    expect(url).toContain(encodeURIComponent(text));
  });

  it('formats daily challenge notification messages with emojis, title, deadline, and links', () => {
    const msg = formatWhatsAppChallengeMessage(
      'Alex',
      3,
      'Dynamic Typography & Kinetic Titles',
      'general',
      'https://procut.app/student/dashboard?tab=internship_sprint'
    );

    expect(msg).toContain('ProCut Hub 15-Day Internship — Day 3 Challenge Drop');
    expect(msg).toContain('Hey Alex!');
    expect(msg).toContain('Dynamic Typography & Kinetic Titles');
    expect(msg).toContain('https://procut.app/student/dashboard?tab=internship_sprint');
  });

  it('formats workshop alert messages with start time and video link', () => {
    const msg = formatWhatsAppWorkshopAlert(
      'Jordan',
      'Live Masterclass: Color Grading & Finishing',
      '7:00 PM IST',
      'https://meet.google.com/xyz-abc-123'
    );

    expect(msg).toContain('Live Masterclass Alert');
    expect(msg).toContain('Jordan');
    expect(msg).toContain('Color Grading & Finishing');
    expect(msg).toContain('7:00 PM IST');
    expect(msg).toContain('https://meet.google.com/xyz-abc-123');
  });

  it('formats inactivity nudges with sprint context to protect completion streaks', () => {
    const msg = formatWhatsAppInactivityNudge(
      'Sam',
      4,
      'https://procut.app/student/dashboard?tab=internship_sprint'
    );

    expect(msg).toContain("Don't lose your streak, Sam!");
    expect(msg).toContain('Day 4');
    expect(msg).toContain('Certificate of Completion');
  });

  it('formats mentor feedback review notifications with status badge and score', () => {
    const msg = formatWhatsAppFeedbackAlert(
      'Ria',
      'Day 05 Multi-Track Sound Design',
      'accepted',
      94,
      'https://procut.app/student/dashboard?tab=internship_sprint'
    );

    expect(msg).toContain('Mentor Review: ACCEPTED');
    expect(msg).toContain('*Score:* 94/100');
    expect(msg).toContain('Day 05 Multi-Track Sound Design');
  });

  describe('Database Persistence & Honest Sprint Metrics', () => {
    it('returns honest zero streak and null mentor rating when student has no completed challenges', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'ch-uuid-1', day_number: 1, title: 'Day 01 Challenge', cohort_id: 'c-1' },
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
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

      const result = await getStudentSprintDays('user-new-1', 'c-1');

      expect(result.completedCount).toBe(0);
      expect(result.streakCount).toBe(0);
      expect(result.overallScore).toBeNull();
      expect(result.days[0].isUnlocked).toBe(true);
      expect(result.days[0].status).toBe('todo');
    });

    it('propagates database errors on daily challenge submission without creating fake local submissions', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            }),
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

      await expect(
        submitDailyChallenge('user-1', 'ch-uuid-1', 'https://github.com/pull/1')
      ).rejects.toThrow();
    });
  });

  describe('Admin Challenge-Authoring & Database Integrity', () => {
    it('creates a daily challenge with valid database record', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'd1111111-1111-1111-1111-111111111111',
              cohort_id: 'c-uuid-1',
              day_number: 16,
              title: 'Day 16: Bonus Motion Graphics Drill',
              track_type: 'general',
              submission_type: 'drive_link',
              deadline_hours: 24,
            },
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
      });

      const res = await createDailyChallenge({
        cohort_id: 'c-uuid-1',
        day_number: 16,
        title: 'Day 16: Bonus Motion Graphics Drill',
        track_type: 'general',
        submission_type: 'drive_link',
        deadline_hours: 24,
        description: null,
        instructions: null,
        starter_files_url: null,
      });

      expect(res.id).toBe('d1111111-1111-1111-1111-111111111111');
      expect(res.title).toBe('Day 16: Bonus Motion Graphics Drill');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          cohort_id: 'c-uuid-1',
          day_number: 16,
          title: 'Day 16: Bonus Motion Graphics Drill',
        })
      );
    });

    it('updates an existing daily challenge', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'd1111111-1111-1111-1111-111111111111',
                  day_number: 16,
                  title: 'Day 16: Advanced Sound & Kinetics',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockUpdate);

      const res = await updateDailyChallenge('d1111111-1111-1111-1111-111111111111', {
        title: 'Day 16: Advanced Sound & Kinetics',
      });

      expect(res.title).toBe('Day 16: Advanced Sound & Kinetics');
    });

    it('deletes a daily challenge by ID', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockDelete);

      await expect(deleteDailyChallenge('d1111111-1111-1111-1111-111111111111')).resolves.toBeUndefined();
    });

    it('seeds default 15-day sprint curriculum into database without returning fake string IDs', async () => {
      const mockUpsert = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: DEFAULT_15_DAY_CURRICULUM.map((c, i) => ({
                ...c,
                id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
                cohort_id: 'c-uuid-1',
              })),
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockUpsert);

      const challenges = await seedCohortDailyChallenges('c-uuid-1');
      expect(challenges).toHaveLength(15);
      expect(challenges[0].id).toBe('00000000-0000-0000-0000-000000000001');
      // Verify no fake default-ch-X IDs exist
      expect(challenges.every((c) => !c.id.startsWith('default-ch-'))).toBe(true);
    });

    it('lists daily challenges for a cohort from database', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: '00000000-0000-0000-0000-000000000001',
                  cohort_id: 'c-uuid-1',
                  day_number: 1,
                  title: 'Day 01 Challenge',
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      const list = await listDailyChallenges('c-uuid-1');
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('rejects submissions with synthetic non-UUID IDs if unresolvable in database', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error('foreign key constraint') }),
            }),
          }),
        };
      });

      await expect(
        submitDailyChallenge('u-1', 'default-ch-999', 'https://drive.google.com/test')
      ).rejects.toThrow('Invalid challenge ID');
    });

    it('seeds Day 1 as published and subsequent days as unpublished by default', () => {
      expect(DEFAULT_15_DAY_CURRICULUM[0].is_published).toBe(true);
      expect(DEFAULT_15_DAY_CURRICULUM[1].is_published).toBe(false);
      expect(DEFAULT_15_DAY_CURRICULUM[14].is_published).toBe(false);
    });

    it('invokes unlockScheduledDailyChallenges RPC for automated midnight execution', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          total_unlocked: 5,
          day_one_unlocked: 1,
          scheduled_unlocked: 4,
          cohorts_affected: 2,
          executed_at: '2026-09-30T00:00:00Z',
        },
        error: null,
      });

      const res = await unlockScheduledDailyChallenges();
      expect(res.success).toBe(true);
      expect(res.total_unlocked).toBe(5);
      expect(supabase.rpc).toHaveBeenCalledWith('unlock_scheduled_daily_challenges');
    });

    it('invokes unlockCohortDailyChallenges RPC for on-demand cohort unlock', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          cohort_id: 'c-uuid-1',
          unlocked_challenges: 3,
          executed_at: '2026-09-30T00:00:00Z',
        },
        error: null,
      });

      const res = await unlockCohortDailyChallenges('c-uuid-1');
      expect(res.success).toBe(true);
      expect(res.unlocked_challenges).toBe(3);
      expect(supabase.rpc).toHaveBeenCalledWith('unlock_cohort_daily_challenges', {
        p_cohort_id: 'c-uuid-1',
      });
    });

    it('allows mentors and admins to manually toggle challenge publication status', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          id: 'ch-toggle-1',
          day_number: 3,
          is_published: true,
          unlocked_at: '2026-09-30T10:00:00Z',
        },
        error: null,
      });

      const res = await setDailyChallengePublicationStatus('ch-toggle-1', true);
      expect(res.success).toBe(true);
      expect(res.is_published).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('set_daily_challenge_publication_status', {
        p_challenge_id: 'ch-toggle-1',
        p_is_published: true,
      });
    });

    it('automatically unlocks sprint challenges when cohort start_date + day_number - 1 has passed', async () => {
      // Cohort started 2 days ago (today is Day 3)
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { sprint_duration_days: 15, start_date: twoDaysAgo.toISOString() },
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
                    { id: 'ch-1', day_number: 1, title: 'Day 1', is_published: true },
                    { id: 'ch-2', day_number: 2, title: 'Day 2', is_published: false },
                    { id: 'ch-3', day_number: 3, title: 'Day 3', is_published: false },
                    { id: 'ch-4', day_number: 4, title: 'Day 4', is_published: false },
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
                  { challenge_id: 'ch-1', status: 'accepted', score: 100 },
                  { challenge_id: 'ch-2', status: 'accepted', score: 95 },
                ],
                error: null,
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const result = await getStudentSprintDays('user-1', 'c-1');

      // Day 1 & Day 2 are completed
      expect(result.days[0].isUnlocked).toBe(true);
      expect(result.days[0].status).toBe('accepted');
      expect(result.days[1].isUnlocked).toBe(true);
      expect(result.days[1].status).toBe('accepted');

      // Day 3 (start_date + 2 days = today) is calendar unlocked and Day 2 was accepted -> Active
      expect(result.days[2].isUnlocked).toBe(true);
      expect(result.days[2].status).toBe('todo');

      // Day 4 (start_date + 3 days = tomorrow) is in future and unpublished -> Locked
      expect(result.days[3].isUnlocked).toBe(false);
      expect(result.days[3].status).toBe('locked');
    });
  });
});

