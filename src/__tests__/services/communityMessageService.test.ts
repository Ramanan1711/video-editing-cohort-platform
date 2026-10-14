import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendChatMessage,
  listChannelMessages,
  subscribeToChatChannel,
  fetchChatChannels,
  fetchDirectMessageUsers,
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
        sender_name: 'Alex',
        sender_role: 'student',
        sender_avatar: 'https://example.com/avatar.png',
        content: 'Check out this new timeline cut!',
      });
      expect(result).toEqual(mockCreated);
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

  describe('fetchChatChannels', () => {
    it('dynamically maps database cohorts into community, QA, and squad channels', async () => {
      const mockCohorts = [
        {
          id: 'cohort-uuid-1',
          title: 'Batch 15 - Masterclass',
          description: 'Advanced Premiere & DaVinci',
          status: 'published',
        },
      ];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockCohorts, error: null }),
            }),
          };
        }
        if (table === 'community_messages') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });

      const channels = await fetchChatChannels();
      expect(channels).toHaveLength(3);
      expect(channels[0].id).toBe('cohort-uuid-1-community');
      expect(channels[0].name).toBe('Batch 15 - Masterclass Community');
      expect(channels[1].id).toBe('cohort-uuid-1-qa');
      expect(channels[2].id).toBe('cohort-uuid-1-squad');
    });

    it('discovers active channels from community_messages when available', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'community_messages') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ channel_id: 'color-grading-critique' }],
                error: null,
              }),
            }),
          };
        }
        return {};
      });

      const channels = await fetchChatChannels();
      expect(channels.some((c) => c.id === 'color-grading-critique')).toBe(true);
    });
  });

  describe('fetchDirectMessageUsers', () => {
    it('dynamically fetches profiles from public_profiles and filters out current user', async () => {
      const mockProfiles = [
        {
          id: 'user-mentor-1',
          full_name: 'Shibin Mentor',
          role: 'mentor',
          avatar_url: 'https://example.com/avatar.jpg',
        },
      ];

      const limitMock = vi.fn().mockResolvedValue({ data: mockProfiles, error: null });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const neqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ order: orderMock, neq: neqMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      const users = await fetchDirectMessageUsers('current-user-uuid');
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe('user-mentor-1');
      expect(users[0].name).toBe('Shibin Mentor');
      expect(users[0].role).toBe('mentor');
      expect(neqMock).toHaveBeenCalledWith('id', 'current-user-uuid');
    });

    it('falls back to profiles table if public_profiles returns error', async () => {
      const mockFallback = [
        {
          id: 'user-admin-1',
          full_name: 'Admin User',
          role: 'admin',
          avatar_url: null,
        },
      ];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'public_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'relation does not exist' } }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockFallback, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const users = await fetchDirectMessageUsers();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Admin User');
      expect(users[0].role).toBe('admin');
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
