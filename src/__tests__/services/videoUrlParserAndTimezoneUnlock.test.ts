import { describe, it, expect, vi } from 'vitest';
import { parseVideoUrl } from '../../lib/services/lessonProgressService';
import { getLocalDateInTimezone, calculateSprintProgress } from '../../lib/internshipService';
import { supabase } from '../../lib/supabaseClient';

describe('2.3 Edge Case & Boundary Analysis: Video URL Parser & Timezone-Aware Unlocking', () => {
  describe('Video Player URL Parsing Resilience', () => {
    it('parses standard YouTube watch URLs', () => {
      const meta = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(meta.type).toBe('embed');
      expect(meta.provider).toBe('youtube');
      expect(meta.videoId).toBe('dQw4w9WgXcQ');
      expect(meta.embedUrl).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
      expect(meta.embedUrl).toContain('enablejsapi=1');
      expect(meta.directUrl).toBeNull();
    });

    it('parses YouTube Shorts URLs and converts to embed player', () => {
      const meta = parseVideoUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
      expect(meta.type).toBe('embed');
      expect(meta.provider).toBe('youtube');
      expect(meta.videoId).toBe('dQw4w9WgXcQ');
      expect(meta.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1&rel=0&modestbranding=1');
      expect(meta.directUrl).toBeNull();
    });

    it('parses YouTube Shorts with query parameters (e.g. ?feature=share)', () => {
      const meta = parseVideoUrl('https://youtube.com/shorts/dQw4w9WgXcQ?feature=share&si=test1234');
      expect(meta.type).toBe('embed');
      expect(meta.provider).toBe('youtube');
      expect(meta.videoId).toBe('dQw4w9WgXcQ');
      expect(meta.embedUrl).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    });

    it('parses YouTube Live streams and unlisted broadcasts', () => {
      const meta = parseVideoUrl('https://www.youtube.com/live/dQw4w9WgXcQ?feature=share');
      expect(meta.type).toBe('embed');
      expect(meta.provider).toBe('youtube');
      expect(meta.videoId).toBe('dQw4w9WgXcQ');
      expect(meta.embedUrl).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    });

    it('parses shortened youtu.be links with timestamps', () => {
      const meta = parseVideoUrl('https://youtu.be/dQw4w9WgXcQ?t=90');
      expect(meta.type).toBe('embed');
      expect(meta.provider).toBe('youtube');
      expect(meta.videoId).toBe('dQw4w9WgXcQ');
      expect(meta.embedUrl).toContain('start=90');
    });

    it('parses standard Vimeo links', () => {
      const meta = parseVideoUrl('https://vimeo.com/76979871');
      expect(meta.type).toBe('embed');
      expect(meta.provider).toBe('vimeo');
      expect(meta.videoId).toBe('76979871');
      expect(meta.embedUrl).toContain('player.vimeo.com/video/76979871');
      expect(meta.embedUrl).toContain('api=1');
    });

    it('parses unlisted Vimeo videos with privacy hash parameter', () => {
      const meta = parseVideoUrl('https://vimeo.com/76979871/9f7a5b3c2d');
      expect(meta.type).toBe('embed');
      expect(meta.provider).toBe('vimeo');
      expect(meta.videoId).toBe('76979871');
      expect(meta.embedUrl).toContain('player.vimeo.com/video/76979871');
      expect(meta.embedUrl).toContain('h=9f7a5b3c2d');
    });

    it('parses standard Loom share and embed links', () => {
      const loomUrl = 'https://www.loom.com/share/d44f7d1b32d8471e847c23fef6173059';
      const meta = parseVideoUrl(loomUrl);
      expect(meta.type).toBe('embed');
      expect(meta.provider).toBe('loom');
      expect(meta.videoId).toBe('d44f7d1b32d8471e847c23fef6173059');
      expect(meta.embedUrl).toContain('https://www.loom.com/embed/d44f7d1b32d8471e847c23fef6173059');
    });

    it('parses custom domain Loom embeds', () => {
      const customDomainLoom = 'https://video.myeditingbrand.com/share/d44f7d1b32d8471e847c23fef6173059';
      const meta = parseVideoUrl(customDomainLoom);
      expect(meta.type).toBe('embed');
      expect(meta.provider).toBe('loom');
      expect(meta.videoId).toBe('d44f7d1b32d8471e847c23fef6173059');
      expect(meta.embedUrl).toContain('loom.com/embed/d44f7d1b32d8471e847c23fef6173059');
    });

    it('parses Wistia media URLs', () => {
      const meta = parseVideoUrl('https://fast.wistia.net/embed/iframe/g9k18h8j');
      expect(meta.type).toBe('embed');
      expect(meta.provider).toBe('wistia');
      expect(meta.videoId).toBe('g9k18h8j');
      expect(meta.embedUrl).toBe('https://fast.wistia.net/embed/iframe/g9k18h8j');
    });

    it('parses Google Drive share links and converts them to /preview embed URLs', () => {
      const meta = parseVideoUrl('https://drive.google.com/file/d/1A2B3C4D5E6F/view?usp=sharing');
      expect(meta.type).toBe('embed');
      expect(meta.provider).toBe('custom_embed');
      expect(meta.embedUrl).toBe('https://drive.google.com/file/d/1A2B3C4D5E6F/preview');
    });

    it('preserves direct video file URLs (.mp4, .webm, storage signed links)', () => {
      const directMp4 = 'https://s3.amazonaws.com/my-bucket/masterclass_01.mp4';
      const meta = parseVideoUrl(directMp4);
      expect(meta.type).toBe('video');
      expect(meta.provider).toBe('direct');
      expect(meta.directUrl).toBe(directMp4);
      expect(meta.embedUrl).toBeNull();
    });

    it('returns empty type for null or whitespace URLs', () => {
      expect(parseVideoUrl(null)).toEqual({ type: 'empty', embedUrl: null, directUrl: null });
      expect(parseVideoUrl('')).toEqual({ type: 'empty', embedUrl: null, directUrl: null });
      expect(parseVideoUrl('   ')).toEqual({ type: 'empty', embedUrl: null, directUrl: null });
    });
  });

  describe('Midnight Challenge Unlock Timezone Skew Remediation', () => {
    it('correctly calculates local calendar date in Asia/Kolkata (IST) during UTC evening', () => {
      // When UTC is 2026-10-14 18:45:00, in IST (UTC+5:30) it is 2026-10-15 00:15:00 AM
      const eveningUtc = new Date('2026-10-14T18:45:00.000Z');
      const localDateIst = getLocalDateInTimezone(eveningUtc, 'Asia/Kolkata');
      const dateInUtc = eveningUtc.toISOString().slice(0, 10);

      // Demonstrates the 5.5 hour skew: UTC is still Oct 14, but India is already Oct 15!
      expect(dateInUtc).toBe('2026-10-14');
      expect(localDateIst).toBe('2026-10-15');
    });

    it('unlocks challenge Day 2 in IST as soon as midnight arrives without waiting for 05:30 AM UTC', async () => {
      // Mock cohort starting on Oct 14 in India
      const cohortId = 'cohort-ist-101';
      const userId = 'student-ist-001';

      // Mock cohort query returning Asia/Kolkata timezone and start_date
      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    sprint_duration_days: 15,
                    start_date: '2026-10-14T00:00:00+05:30',
                    timezone: 'Asia/Kolkata',
                  },
                  error: null,
                }),
              }),
            }),
          } as never;
        }

        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'ch-1', day_number: 1, title: 'Day 1 Challenge', is_published: true, cohort_id: cohortId },
                    { id: 'ch-2', day_number: 2, title: 'Day 2 Challenge', is_published: false, cohort_id: cohortId },
                  ],
                  error: null,
                }),
              }),
            }),
          } as never;
        }

        if (table === 'daily_challenge_submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'sub-1', challenge_id: 'ch-1', status: 'accepted', score: 95 }],
                error: null,
              }),
            }),
          } as never;
        }

        return {} as never;
      });

      // Advance mock timer to 12:05 AM IST on Oct 15 (which is 18:35 UTC on Oct 14)
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-14T18:35:00.000Z')); // 12:05 AM IST

      const sprintProgress = await calculateSprintProgress(cohortId, userId);

      expect(sprintProgress.days.length).toBeGreaterThanOrEqual(2);
      expect(sprintProgress.days[0].dayNumber).toBe(1);
      expect(sprintProgress.days[0].status).toBe('accepted');

      // Day 2 should be unlocked (status: 'todo', NOT 'locked') at 12:05 AM IST!
      expect(sprintProgress.days[1].dayNumber).toBe(2);
      expect(sprintProgress.days[1].status).toBe('todo');

      vi.useRealTimers();
    });
  });
});
