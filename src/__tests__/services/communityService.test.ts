import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listCohortPosts,
  createCommunityPost,
  deleteCommunityPost,
  listCommunityComments,
  addCommunityComment,
  deleteCommunityComment,
  togglePostReaction,
  reportCommunityPost,
  listCommunityReports,
  resolveCommunityReport,
  moderateCommunityPostStatus,
  detectMediaType,
  parsePostMediaEnvelope,
} from '../../lib/communityService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => {
  const fromMock = vi.fn();
  const rpcMock = vi.fn();
  const authMock = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-123' } },
      error: null,
    }),
  };
  const channelMock = vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({}),
  });
  const removeChannelMock = vi.fn();

  return {
    supabase: {
      from: fromMock,
      rpc: rpcMock,
      auth: authMock,
      channel: channelMock,
      removeChannel: removeChannelMock,
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn(),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/asset.mp4' } }),
        }),
      },
    },
  };
});

describe('communityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectMediaType & parsePostMediaEnvelope', () => {
    it('detects video files and video streaming urls', () => {
      expect(detectMediaType('https://www.youtube.com/watch?v=123')).toBe('video');
      expect(detectMediaType('edit_cut_v1.mp4')).toBe('video');
      expect(detectMediaType('clip.mov')).toBe('video');
    });

    it('detects image files', () => {
      expect(detectMediaType('thumbnail.jpg')).toBe('image');
      expect(detectMediaType('cover.png')).toBe('image');
      expect(detectMediaType('banner.webp')).toBe('image');
    });

    it('defaults to file for archives and documents', () => {
      expect(detectMediaType('project_files.zip')).toBe('file');
      expect(detectMediaType('brief.pdf')).toBe('file');
    });

    it('parses attachment metadata envelopes correctly', () => {
      const raw = '[attachment:{"url":"https://example.com/cut.mp4","type":"video","name":"cut.mp4"}]\nReview my 15-second cut!';
      const parsed = parsePostMediaEnvelope(raw);
      expect(parsed.body).toBe('Review my 15-second cut!');
      expect(parsed.mediaUrl).toBe('https://example.com/cut.mp4');
      expect(parsed.mediaType).toBe('video');
      expect(parsed.fileName).toBe('cut.mp4');
    });

    it('handles raw plain text without attachment envelopes', () => {
      const parsed = parsePostMediaEnvelope('Just a quick question about DaVinci Resolve.');
      expect(parsed.body).toBe('Just a quick question about DaVinci Resolve.');
      expect(parsed.mediaUrl).toBeNull();
      expect(parsed.mediaType).toBeNull();
    });
  });

  describe('Posts CRUD & Listing', () => {
    it('lists cohort posts with comments count and user reactions', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          author_id: 'user-1',
          cohort_id: 'cohort-1',
          lesson_id: null,
          title: 'Color Grading tips',
          body: 'Check out this LUT.',
          is_pinned: true,
          moderation_status: 'published',
          created_at: '2026-09-29T10:00:00Z',
        },
      ];

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'community_posts') {
          return {
            select: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'public_profiles' || table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'user-1', full_name: 'Lead Mentor', role: 'mentor' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'community_comments') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'comm-1', post_id: 'post-1' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'community_reactions') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ post_id: 'post-1', user_id: 'test-user-123', emoji: '🔥' }],
                error: null,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const posts = await listCohortPosts('cohort-1');
      expect(posts).toHaveLength(1);
      expect(posts[0].author_name).toBe('Lead Mentor');
      expect(posts[0].author_role).toBe('mentor');
      expect(posts[0].comment_count).toBe(1);
      expect(posts[0].reactions).toEqual({ '🔥': 1 });
      expect(posts[0].user_reactions).toEqual(['🔥']);
    });

    it('creates a new community post', async () => {
      const mockCreated = {
        id: 'new-post-1',
        author_id: 'test-user-123',
        cohort_id: 'cohort-1',
        title: 'Timeline Sync Question',
        body: 'How do you sync audio in Premiere?',
        is_pinned: false,
        moderation_status: 'published',
        created_at: new Date().toISOString(),
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
          }),
        }),
      });

      const post = await createCommunityPost(
        'test-user-123',
        'How do you sync audio in Premiere?',
        'cohort-1',
        null,
        'Timeline Sync Question'
      );

      expect(post.id).toBe('new-post-1');
      expect(post.title).toBe('Timeline Sync Question');
    });

    it('deletes a community post', async () => {
      (supabase.from as any).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await expect(deleteCommunityPost('post-1')).resolves.toBeUndefined();
    });
  });

  describe('Comments Management', () => {
    it('lists comments with author details', async () => {
      const mockComments = [
        {
          id: 'comm-1',
          post_id: 'post-1',
          author_id: 'author-1',
          body: 'Great technique!',
          created_at: '2026-09-29T10:05:00Z',
        },
      ];

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'community_comments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockComments, error: null }),
              }),
            }),
          };
        }
        if (table === 'public_profiles' || table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'author-1', full_name: 'Editor Pro', role: 'student' }],
                error: null,
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const comments = await listCommunityComments('post-1');
      expect(comments).toHaveLength(1);
      expect(comments[0].author_name).toBe('Editor Pro');
      expect(comments[0].body).toBe('Great technique!');
    });

    it('adds a comment to a post', async () => {
      const mockComment = {
        id: 'comm-2',
        post_id: 'post-1',
        author_id: 'test-user-123',
        body: 'Check out the new cut.',
        created_at: new Date().toISOString(),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'community_comments') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockComment, error: null }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { full_name: 'Test Editor', role: 'student' },
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const comment = await addCommunityComment('post-1', 'test-user-123', 'Check out the new cut.');
      expect(comment.id).toBe('comm-2');
      expect(comment.author_name).toBe('Test Editor');
    });

    it('deletes a comment by id', async () => {
      (supabase.from as any).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await expect(deleteCommunityComment('comm-1')).resolves.toBeUndefined();
    });
  });

  describe('Reactions', () => {
    it('toggles reaction on and off', async () => {
      // 1. Adding when not present
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const addResult = await togglePostReaction('post-1', 'user-1', '🔥');
      expect(addResult.added).toBe(true);

      // 2. Removing when already present
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'react-1' } }),
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const removeResult = await togglePostReaction('post-1', 'user-1', '🔥');
      expect(removeResult.added).toBe(false);
    });
  });

  describe('Reports & Moderation', () => {
    it('submits a report via RPC with fallback to direct table insert', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: 'rep-uuid-1', error: null });

      await expect(
        reportCommunityPost('post-1', 'user-1', 'Inappropriate commentary')
      ).resolves.toBeUndefined();

      expect(supabase.rpc).toHaveBeenCalledWith('report_community_post', {
        p_post_id: 'post-1',
        p_reason: 'Inappropriate commentary',
      });
    });

    it('lists community reports with post and reporter information', async () => {
      const mockReports = [
        {
          id: 'rep-1',
          post_id: 'post-1',
          reporter_id: 'user-2',
          reason: 'Spam link',
          status: 'pending',
          resolution_notes: null,
          resolved_by: null,
          resolved_at: null,
          created_at: '2026-09-29T10:10:00Z',
        },
      ];

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'community_reports') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockReports, error: null }),
            }),
          };
        }
        if (table === 'community_posts') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'post-1', title: 'Free Plugins', body: 'Visit this url' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'user-2', full_name: 'Reporting Student', email: 'student2@example.com' }],
                error: null,
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const reports = await listCommunityReports();
      expect(reports).toHaveLength(1);
      expect(reports[0].reason).toBe('Spam link');
      expect(reports[0].post_title).toBe('Free Plugins');
      expect(reports[0].reporter_name).toBe('Reporting Student');
      expect(reports[0].reporter_email).toBe('student2@example.com');
    });

    it('resolves a community report via RPC or direct update', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      await expect(
        resolveCommunityReport('rep-1', 'resolved', 'Post reviewed and cleared')
      ).resolves.toBeUndefined();

      expect(supabase.rpc).toHaveBeenCalledWith('resolve_community_report', {
        p_report_id: 'rep-1',
        p_status: 'resolved',
        p_notes: 'Post reviewed and cleared',
      });
    });

    it('moderates community post status (published, flagged, hidden)', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      await expect(
        moderateCommunityPostStatus('post-1', 'hidden')
      ).resolves.toBeUndefined();

      expect(supabase.rpc).toHaveBeenCalledWith('moderate_community_post', {
        p_post_id: 'post-1',
        p_status: 'hidden',
      });
    });
  });
});
