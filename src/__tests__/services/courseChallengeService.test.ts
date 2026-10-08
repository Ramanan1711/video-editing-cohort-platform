import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCourseChallenges,
  createCourseChallenge,
  joinCourseChallenge,
  submitCourseChallenge,
  getDefaultChallengesForCohort,
  uploadChallengeAsset,
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
      storage: {
        from: storageFromMock,
      },
    },
  };
});

describe('courseChallengeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('getDefaultChallengesForCohort (Domain-Aware Seeds)', () => {
    it('returns Video Editing challenges for video tracks', () => {
      const challenges = getDefaultChallengesForCohort('cohort-video-1', 'CineSprint Video Editing Batch 15');
      expect(challenges.length).toBeGreaterThan(0);
      expect(challenges[0].title).toContain('Remix the emotion');
      expect(challenges.some((c) => c.title.includes('Color Grading'))).toBe(true);
    });

    it('returns Full-Stack Coding challenges for coding tracks', () => {
      const challenges = getDefaultChallengesForCohort('cohort-code-1', 'Fullstack Web Development Cohort');
      expect(challenges.length).toBeGreaterThan(0);
      expect(challenges.some((c) => c.title.includes('Sprint'))).toBe(true);
      expect(challenges.some((c) => c.title.includes('Clean UI Architecture'))).toBe(true);
    });

    it('returns Motion Graphics challenges for animation tracks', () => {
      const challenges = getDefaultChallengesForCohort('cohort-motion-1', 'Motion Graphics Masters');
      expect(challenges.length).toBeGreaterThan(0);
      expect(challenges.some((c) => c.title.includes('Kinetic Typography'))).toBe(true);
      expect(challenges.some((c) => c.title.includes('3D Logo Reveal'))).toBe(true);
    });
  });

  describe('fetchCourseChallenges', () => {
    it('returns default domain challenges when database table has no records', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const challenges = await fetchCourseChallenges('cohort-1', 'CineSprint Video Editing Batch 15');
      expect(challenges.length).toBeGreaterThan(0);
      expect(challenges[0].cohortId).toBe('cohort-1');
      expect(challenges[0].cohortTitle).toBe('CineSprint Video Editing Batch 15');
    });

    it('returns database challenges when available', async () => {
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
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [mockDbRow], error: null }),
          }),
        }),
      });

      const challenges = await fetchCourseChallenges('cohort-video-99', 'Video Editing');
      expect(challenges).toHaveLength(1);
      expect(challenges[0].id).toBe('db-ch-1');
      expect(challenges[0].title).toBe('Custom Client Commercial Edit');
      expect(challenges[0].assets?.[0].title).toBe('Raw Footage 4K');
    });
  });

  describe('createCourseChallenge', () => {
    it('creates a challenge for a specific course and persists it', async () => {
      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
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

      // Verify that subsequent fetch for that cohort returns this newly created challenge
      const list = await fetchCourseChallenges('cohort-custom-1', 'Advanced Color Grading Masterclass');
      expect(list.some((c) => c.title === 'Commercial Film Emulation LUT Challenge')).toBe(true);
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
    it('persists student join state', async () => {
      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      await joinCourseChallenge('ch-w3-proj', 'student-123');

      const challenges = await fetchCourseChallenges('cohort-1', 'CineSprint Video Editing Batch 15');
      const joined = challenges.find((c) => c.id === 'ch-w3-proj');
      expect(joined?.isJoined).toBe(true);
    });

    it('persists student submission state', async () => {
      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      await submitCourseChallenge(
        'ch-w3-proj',
        'student-123',
        'https://youtube.com/watch?v=submission',
        'Added subtle halation and grain'
      );

      const challenges = await fetchCourseChallenges('cohort-1', 'CineSprint Video Editing Batch 15');
      const submitted = challenges.find((c) => c.id === 'ch-w3-proj');
      expect(submitted?.hasSubmitted).toBe(true);
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
});

