import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCourseChallenges,
  createCourseChallenge,
  deleteCourseChallenge,
  joinCourseChallenge,
  submitCourseChallenge,
  getDefaultChallengesForCohort,
  uploadChallengeAsset,
  fetchChallengeParticipants,
  fetchChallengeSubmissions,
  formatChallengeCountdown,
} from '../../lib/courseChallengeService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => {
  const fromMock = vi.fn();
  const storageFromMock = vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({ data: { path: 'challenges/video.zip' }, error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://test.supabase.co/storage/v1/object/sign/course-assets/challenges/video.zip?token=mock_token' },
      error: null,
    }),
  });

  return {
    supabase: {
      from: fromMock,
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
      },
      storage: {
        from: storageFromMock,
      },
    },
  };
});

describe('courseChallengeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDefaultChallengesForCohort (No hardcoded data)', () => {
    it('returns empty array ensuring zero fallback mock records', () => {
      const challenges = getDefaultChallengesForCohort('cohort-video-1', 'CineSprint Video Editing Batch 15');
      expect(challenges).toEqual([]);
    });
  });

  describe('fetchCourseChallenges', () => {
    it('returns empty array when database table has no records for the cohort', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const challenges = await fetchCourseChallenges('cohort-1', 'CineSprint Video Editing Batch 15');
      expect(challenges).toEqual([]);
    });

    it('returns database challenges mapped with participants and submissions', async () => {
      const mockDbRow = {
        id: 'db-ch-1',
        cohort_id: 'cohort-video-99',
        type: 'PROJECT',
        week: 'WEEK 1',
        title: 'Custom Client Commercial Edit',
        description: 'Edit a 30s cut with pacing notes',
        start_date: '1 Oct',
        end_date: '8 Oct 2026',
        duration_label: '7 days',
        status: 'active',
        participants_joined: 12,
        pro_reward: 100,
        asset_url: 'https://example.com/asset.zip',
        asset_name: 'Raw Footage 4K',
        asset_size: '2.5 GB',
        participants: [{ user_id: 'test-user-id', joined_at: '2026-10-01' }],
        submissions: [{ id: 'sub-1', user_id: 'test-user-id', status: 'pending', submission_url: 'https://loom.com' }],
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [mockDbRow], error: null }),
          }),
        }),
      });

      const challenges = await fetchCourseChallenges('cohort-video-99', 'Video Editing', 'test-user-id');
      expect(challenges).toHaveLength(1);
      expect(challenges[0].id).toBe('db-ch-1');
      expect(challenges[0].title).toBe('Custom Client Commercial Edit');
      expect(challenges[0].isJoined).toBe(true);
      expect(challenges[0].hasSubmitted).toBe(true);
      expect(challenges[0].assets?.[0].title).toBe('Raw Footage 4K');
    });
  });

  describe('createCourseChallenge', () => {
    it('creates a challenge in database and records author join', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as any).mockReturnValue({
        insert: insertMock,
      });

      const created = await createCourseChallenge(
        {
          cohortId: 'cohort-custom-1',
          cohortTitle: 'Advanced Color Grading Masterclass',
          title: 'Commercial Film Emulation LUT Challenge',
          type: 'PROJECT',
          week: 'WEEK 2',
          startDate: '10 Oct',
          endDate: '17 Oct 2026',
          durationLabel: '7 days',
          status: 'active',
          proReward: 150,
          description: 'Build a film emulation powergrade in DaVinci Resolve',
          assetUrl: 'https://drive.google.com/file/d/test',
          assetName: 'Film Stock Stills (4K)',
        },
        { id: 'mentor-1', name: 'Lead Colorist' }
      );

      expect(created).toBeDefined();
      expect(created.cohortId).toBe('cohort-custom-1');
      expect(created.title).toBe('Commercial Film Emulation LUT Challenge');
      expect(created.proReward).toBe(150);
      expect(created.isJoined).toBe(true);
      expect(insertMock).toHaveBeenCalled();
    });

    it('uploads attached asset file and links it to created challenge', async () => {
      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const file = new File(['mock content'], 'footage_pack.zip', { type: 'application/zip' });

      const created = await createCourseChallenge({
        cohortId: 'cohort-1',
        title: 'Documentary Rough Cut Challenge',
        type: 'PROJECT',
        week: 'WEEK 3',
        startDate: '12 Oct',
        endDate: '19 Oct 2026',
        assetFile: file,
      });

      expect(created.assets).toBeDefined();
      expect(created.assets?.[0].title).toBe('footage_pack.zip');
      expect(created.assets?.[0].url).toContain('token=mock_token');
    });
  });

  describe('joinCourseChallenge & submitCourseChallenge', () => {
    it('persists student join state via Supabase insert', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as any).mockReturnValue({
        insert: insertMock,
      });

      await joinCourseChallenge('ch-w3-proj', 'student-123');

      expect(insertMock).toHaveBeenCalledWith({
        challenge_id: 'ch-w3-proj',
        user_id: 'student-123',
      });
    });

    it('persists student submission state via Supabase upsert', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as any).mockReturnValue({
        upsert: upsertMock,
      });

      await submitCourseChallenge(
        'ch-w3-proj',
        'student-123',
        'https://youtube.com/watch?v=submission',
        'Added subtle halation and grain'
      );

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge_id: 'ch-w3-proj',
          user_id: 'student-123',
          submission_url: 'https://youtube.com/watch?v=submission',
          notes: 'Added subtle halation and grain',
          status: 'pending',
        }),
        { onConflict: 'challenge_id,user_id' }
      );
    });
  });

  describe('uploadChallengeAsset', () => {
    it('uploads asset to course-assets bucket and formats labels', async () => {
      const file = new File(['mock large content'], 'trailer_raw_footage.zip', {
        type: 'application/zip',
      });

      const res = await uploadChallengeAsset(file, 'cohort-1');
      expect(res.name).toBe('trailer_raw_footage.zip');
      expect(res.type).toBe('.zip');
      expect(res.url).toContain('token=mock_token');
      expect(supabase.storage.from).toHaveBeenCalledWith('course-assets');
    });
  });

  describe('deleteCourseChallenge', () => {
    it('deletes an existing course challenge from database', async () => {
      const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as any).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: deleteEqMock,
        }),
      });

      const deleted = await deleteCourseChallenge('ch-to-delete');
      expect(deleted).toBe(true);
      expect(deleteEqMock).toHaveBeenCalledWith('id', 'ch-to-delete');
    });
  });

  describe('fetchChallengeParticipants & fetchChallengeSubmissions', () => {
    it('fetches real participant profiles', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  user_id: 'u-1',
                  joined_at: '2026-10-01T10:00:00Z',
                  profile: { id: 'u-1', full_name: 'Alex Editor', email: 'alex@example.com' },
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const participants = await fetchChallengeParticipants('ch-1');
      expect(participants).toHaveLength(1);
      expect(participants[0].fullName).toBe('Alex Editor');
    });

    it('fetches real challenge submissions', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'sub-1',
                  user_id: 'u-1',
                  submission_url: 'https://youtube.com/watch?v=1',
                  notes: 'First cut',
                  status: 'reviewed',
                  score: 95,
                  submitted_at: '2026-10-02T10:00:00Z',
                  profile: { id: 'u-1', full_name: 'Alex Editor' },
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const submissions = await fetchChallengeSubmissions('ch-1');
      expect(submissions).toHaveLength(1);
      expect(submissions[0].score).toBe(95);
      expect(submissions[0].status).toBe('reviewed');
    });
  });

  describe('formatChallengeCountdown', () => {
    it('returns Active or formatted time for future date', () => {
      const future = new Date(Date.now() + 86400000 * 3).toISOString();
      const str = formatChallengeCountdown(future);
      expect(str).toContain('Ends in');
    });

    it('returns Ended for past date', () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      const str = formatChallengeCountdown(past);
      expect(str).toBe('Ended');
    });
  });
});
