import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendChatMessage,
  listChannelMessages,
  subscribeToChatChannel,
  fetchChatChannels,
  fetchDirectMessageUsers,
  getUserEnrolledCohortIds,
  getDirectMessageChannelId,
  listDirectMessages,
  subscribeToDirectMessages,
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
        if (table === 'community_messages') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        channel_id: 'peer-user-batch-1',
                        sender_id: 'current-student-1',
                        content: 'Hey classmate!',
                      },
                    ],
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
      expect(dms[0].last_message).toBe('Hey classmate!');
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
        body: 'Check out this new timeline cut!',
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

    it('falls back seamlessly if database schema enforces NOT NULL on body (code 23502)', async () => {
      const mockCreated = {
        id: 'msg-fallback-body',
        channel_id: 'batch-15-community',
        sender_id: '11111111-1111-1111-1111-111111111111',
        sender_name: 'Alex',
        sender_role: 'student',
        body: 'Hello with body',
        created_at: new Date().toISOString(),
      };

      let callCount = 0;
      const singleMock = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: null,
            error: { code: '23502', message: 'null value in column "body" of relation "community_messages" violates not-null constraint' },
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
        'Hello with body'
      );

      expect(callCount).toBe(2);
      expect(res.id).toBe('msg-fallback-body');
      expect(res.content).toBe('Hello with body');
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

  describe('getDirectMessageChannelId', () => {
    it('produces symmetric canonical channel IDs regardless of argument order', () => {
      const userA = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b';
      const userB = '591e5ba9-2d77-4f7f-ab8b-ed9f97ebda55';

      const channelIdAB = getDirectMessageChannelId(userA, userB);
      const channelIdBA = getDirectMessageChannelId(userB, userA);

      expect(channelIdAB).toBe('dm-591e5ba9-2d77-4f7f-ab8b-ed9f97ebda55-e7d1e39f-d098-42d3-a0b0-6a1e93c3538b');
      expect(channelIdAB).toBe(channelIdBA);
    });

    it('handles empty or blank arguments gracefully', () => {
      expect(getDirectMessageChannelId('', '')).toBe('dm');
      expect(getDirectMessageChannelId('user-1', '')).toBe('dm-user-1');
    });
  });

  describe('listDirectMessages', () => {
    const userA = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b';
    const userB = '591e5ba9-2d77-4f7f-ab8b-ed9f97ebda55';
    const canonicalDmId = 'dm-591e5ba9-2d77-4f7f-ab8b-ed9f97ebda55-e7d1e39f-d098-42d3-a0b0-6a1e93c3538b';

    it('returns empty array when either user id is missing', async () => {
      expect(await listDirectMessages('', userB)).toEqual([]);
      expect(await listDirectMessages(userA, '')).toEqual([]);
    });

    it('retrieves both canonical direct messages and backward-compatible legacy direct messages', async () => {
      const dbRows = [
        // Legacy message sent from userA to userB where channel_id was set to userB
        {
          id: '01e236b6-b3b4-4748-86cf-a624bc070804',
          channel_id: userB,
          author_id: userA,
          sender_id: userA,
          sender_name: 'Ramanan',
          sender_role: 'admin',
          body: 'hi',
          content: 'hi',
          created_at: '2026-10-14 12:16:30.379302+00',
        },
        // Canonical message sent on dm-... channel
        {
          id: 'canonical-msg-1',
          channel_id: canonicalDmId,
          author_id: userB,
          sender_id: userB,
          sender_name: 'Ajay 4444',
          sender_role: 'student',
          body: 'hello back!',
          content: 'hello back!',
          created_at: '2026-10-14 12:18:00+00',
        },
        // Third-party message that should be filtered out
        {
          id: 'third-party-msg',
          channel_id: userB,
          author_id: 'stranger-id',
          sender_id: 'stranger-id',
          content: 'ignore this',
        },
      ];

      const orderMock = vi.fn().mockResolvedValue({
        data: dbRows,
        error: null,
      });
      const inMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ in: inMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      const messages = await listDirectMessages(userA, userB);

      expect(supabase.from).toHaveBeenCalledWith('community_messages');
      expect(inMock).toHaveBeenCalledWith('channel_id', [canonicalDmId, userA, userB]);
      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('01e236b6-b3b4-4748-86cf-a624bc070804');
      expect(messages[0].content).toBe('hi');
      expect(messages[0].channel_id).toBe(canonicalDmId);
      expect(messages[1].id).toBe('canonical-msg-1');
      expect(messages[1].content).toBe('hello back!');
    });

    it('returns empty array when direct messages database query fails', async () => {
      const orderMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });
      const inMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ in: inMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      const messages = await listDirectMessages(userA, userB);
      expect(messages).toEqual([]);
    });
  });

  describe('subscribeToDirectMessages', () => {
    it('subscribes to canonical and legacy recipient filters and cleans up properly', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      };
      (supabase.channel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockChannel);

      const userA = 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b';
      const userB = '591e5ba9-2d77-4f7f-ab8b-ed9f97ebda55';
      const callback = vi.fn();

      const unsubscribe = subscribeToDirectMessages(userA, userB, callback);

      expect(supabase.channel).toHaveBeenCalledWith('dm-dm-591e5ba9-2d77-4f7f-ab8b-ed9f97ebda55-e7d1e39f-d098-42d3-a0b0-6a1e93c3538b');
      expect(mockChannel.on).toHaveBeenCalledTimes(3);

      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('returns noop cleanup when user IDs are not provided', () => {
      const unsubscribe = subscribeToDirectMessages('', '', vi.fn());
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });
});
