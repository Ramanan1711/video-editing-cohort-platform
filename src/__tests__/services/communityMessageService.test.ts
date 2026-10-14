import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendChatMessage,
  listChannelMessages,
  subscribeToChatChannel,
  fetchChatChannels,
  fetchDirectMessageUsers,
  getUserEnrolledCohortIds,
  DEFAULT_CHANNELS,
  DEFAULT_DIRECT_MESSAGES,
} from '../../lib/communityMessageService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => {
  const insertMock = vi.fn();
  const selectMock = vi.fn();
  const eqMock = vi.fn();
  const orderMock = vi.fn();
  const singleMock = vi.fn();
  const fromMock = vi.fn();
  const channelMock = vi.fn();
  const removeChannelMock = vi.fn();

  return {
    supabase: {
      from: fromMock,
      channel: channelMock,
      removeChannel: removeChannelMock,
      __mocks: {
        insertMock,
        selectMock,
        eqMock,
        orderMock,
        singleMock,
        fromMock,
        channelMock,
        removeChannelMock,
      },
    },
  };
});

describe('communityMessageService (Authoritative Delivery & Fail-Closed Guards)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('zero hardcoded mock data assertion', () => {
    it('exports DEFAULT_CHANNELS as empty array with no hardcoded channels', () => {
      expect(DEFAULT_CHANNELS).toEqual([]);
    });

    it('exports DEFAULT_DIRECT_MESSAGES as empty array with no hardcoded contacts', () => {
      expect(DEFAULT_DIRECT_MESSAGES).toEqual([]);
    });
  });

  describe('getUserEnrolledCohortIds', () => {
    it('returns empty array when userId is empty or null', async () => {
      const ids = await getUserEnrolledCohortIds('');
      expect(ids).toEqual([]);
    });

    it('retrieves enrolled, active, completed, and inactive cohort ids from enrollments and mentor_cohorts', async () => {
      let enrolledStatusFilter: string[] = [];
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockImplementation((_col: string, values: string[]) => {
                  enrolledStatusFilter = values;
                  return Promise.resolve({
                    data: [
                      { cohort_id: 'c4f1cf6e-6619-4a07-8c28-5a18e163e86f' }, // inactive
                      { cohort_id: '02eebd78-f652-4277-8ab5-18cceb2d7d40' }, // enrolled
                    ],
                    error: null,
                  });
                }),
              }),
            }),
          };
        }
        if (table === 'mentor_cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return {};
      });

      const ids = await getUserEnrolledCohortIds('user-123');
      expect(enrolledStatusFilter).toEqual(['enrolled', 'active', 'completed', 'inactive']);
      expect(ids).toEqual([
        'c4f1cf6e-6619-4a07-8c28-5a18e163e86f',
        '02eebd78-f652-4277-8ab5-18cceb2d7d40',
      ]);
      expect(ids.length).toBe(2);
    });
  });

  describe('fetchChatChannels (Scoped to Enrolled Courses)', () => {
    it('displays only channels for the courses enrolled by the user', async () => {
      const enrolledCohort = {
        id: 'cohort-enrolled-1',
        title: 'Video Editing Masterclass',
        description: 'Enrolled course',
        status: 'published',
      };

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ cohort_id: 'cohort-enrolled-1' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'mentor_cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [enrolledCohort],
                  error: null,
                }),
              }),
              order: vi.fn().mockResolvedValue({
                data: [enrolledCohort],
                error: null,
              }),
            }),
          };
        }
        return {};
      });

      const channels = await fetchChatChannels('student-user-1');
      expect(channels).toHaveLength(3);
      expect(channels.map((c) => c.id)).toEqual([
        'cohort-enrolled-1-community',
        'cohort-enrolled-1-qa',
        'cohort-enrolled-1-squad',
      ]);
      expect(channels[0].name).toBe('Video Editing Masterclass Community');
    });

    it('does not display any channels if the student is not enrolled in any course', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'mentor_cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'student' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const channels = await fetchChatChannels('unenrolled-student');
      expect(channels).toEqual([]);
    });
  });

  describe('fetchDirectMessageUsers (Scoped to Enrolled Courses)', () => {
    it('displays direct message contacts strictly belonging to the user enrolled courses', async () => {
      const mockPeerProfiles = [
        {
          id: 'peer-user-batch-1',
          full_name: 'Peer in Same Cohort',
          role: 'student',
          avatar_url: 'https://example.com/peer.png',
        },
      ];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              // First call: getUserEnrolledCohortIds
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ cohort_id: 'cohort-1' }],
                  error: null,
                }),
              }),
              // Second call: finding peers in enrolled cohorts
              in: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [{ user_id: 'peer-user-batch-1' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'mentor_cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              in: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'public_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: mockPeerProfiles,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const dms = await fetchDirectMessageUsers('current-student-1');
      expect(dms).toHaveLength(1);
      expect(dms[0].id).toBe('peer-user-batch-1');
      expect(dms[0].name).toBe('Peer in Same Cohort');
    });

    it('returns empty array when student has no course enrollments and is not an admin', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'mentor_cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'student' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const dms = await fetchDirectMessageUsers('student-with-no-courses');
      expect(dms).toEqual([]);
    });
  });

  describe('sendChatMessage', () => {
    it('validates that message content is not empty or pure whitespace', async () => {
      await expect(
        sendChatMessage(
          'batch-15-community',
          { id: '11111111-1111-1111-1111-111111111111', name: 'Student', role: 'student' },
          '   '
        )
      ).rejects.toThrow('Message content cannot be empty.');
    });

    it('requires a valid authenticated sender id', async () => {
      await expect(
        sendChatMessage(
          'batch-15-community',
          { id: '', name: 'Student', role: 'student' },
          'Hello world'
        )
      ).rejects.toThrow('Authentication required');
    });

    it('successfully inserts into public.community_messages and returns the authoritative record', async () => {
      const mockCreated = {
        id: 'msg-db-123',
        channel_id: 'batch-15-community',
        sender_id: '11111111-1111-1111-1111-111111111111',
        sender_name: 'Alex',
        sender_role: 'student',
        sender_avatar: 'https://example.com/avatar.png',
        content: 'Check out this new timeline cut!',
        created_at: new Date().toISOString(),
      };

      const singleMock = vi.fn().mockResolvedValue({
        data: mockCreated,
        error: null,
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: insertMock,
      });

      const result = await sendChatMessage(
        'batch-15-community',
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Alex',
          role: 'student',
          avatar: 'https://example.com/avatar.png',
        },
        'Check out this new timeline cut!'
      );

      expect(supabase.from).toHaveBeenCalledWith('community_messages');
      expect(insertMock).toHaveBeenCalledWith({
        channel_id: 'batch-15-community',
        sender_id: '11111111-1111-1111-1111-111111111111',
        author_id: '11111111-1111-1111-1111-111111111111',
        sender_name: 'Alex',
        sender_role: 'student',
        sender_avatar: 'https://example.com/avatar.png',
        content: 'Check out this new timeline cut!',
      });
      expect(result).toEqual(mockCreated);
    });

    it('falls back seamlessly if database schema does not have author_id column', async () => {
      const mockCreated = {
        id: 'msg-fallback-author',
        channel_id: 'batch-15-community',
        sender_id: '11111111-1111-1111-1111-111111111111',
        sender_name: 'Alex',
        sender_role: 'student',
        content: 'Hello without author_id',
        created_at: new Date().toISOString(),
      };

      let callCount = 0;
      const singleMock = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: null,
            error: { code: '42703', message: 'column "author_id" of relation "community_messages" does not exist' },
          });
        }
        return Promise.resolve({
          data: mockCreated,
          error: null,
        });
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: insertMock,
      });

      const res = await sendChatMessage(
        'batch-15-community',
        { id: '11111111-1111-1111-1111-111111111111', name: 'Alex', role: 'student' },
        'Hello without author_id'
      );

      expect(callCount).toBe(2);
      expect(res.id).toBe('msg-fallback-author');
    });

    it('fails closed and throws an error if Supabase rejects the write (RLS or network)', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'new row violates row-level security policy for table "community_messages"' },
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: insertMock,
      });

      await expect(
        sendChatMessage(
          'batch-15-community',
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Alex',
            role: 'student',
          },
          'Unsent message'
        )
      ).rejects.toThrow('row-level security policy');

      // Verify no illusion of delivery is persisted into localStorage
      expect(localStorage.getItem('video_editing_community_messages_v1')).toBeNull();
    });
  });

  describe('listChannelMessages', () => {
    it('returns messages from public.community_messages when available in Supabase', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          channel_id: 'batch-15-community',
          sender_id: 'user-1',
          sender_name: 'John',
          sender_role: 'student',
          content: 'Hello everyone!',
          created_at: new Date().toISOString(),
        },
      ];

      const orderMock = vi.fn().mockResolvedValue({
        data: mockMessages,
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      const messages = await listChannelMessages('batch-15-community');
      expect(messages).toEqual(mockMessages);
      expect(supabase.from).toHaveBeenCalledWith('community_messages');
      expect(eqMock).toHaveBeenCalledWith('channel_id', 'batch-15-community');
    });

    it('returns empty array when database has no messages for channel (zero hardcoded fallback)', async () => {
      const orderMock = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      const messages = await listChannelMessages('batch-15-community');
      expect(messages).toEqual([]);
    });

    it('returns empty array gracefully if database query returns an error', async () => {
      const orderMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'relation "community_messages" does not exist' },
      });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      const messages = await listChannelMessages('batch-15-community');
      expect(messages).toEqual([]);
    });
  });

  describe('subscribeToChatChannel', () => {
    it('sets up Supabase Realtime channel subscription and cleans up properly', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      };
      (supabase.channel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockChannel);

      const callback = vi.fn();
      const unsubscribe = subscribeToChatChannel('batch-15-community', callback);

      expect(supabase.channel).toHaveBeenCalledWith('chat-batch-15-community');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages',
          filter: 'channel_id=eq.batch-15-community',
        }),
        expect.any(Function)
      );

      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
