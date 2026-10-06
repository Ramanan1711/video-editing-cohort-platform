import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendChatMessage,
  listChannelMessages,
  subscribeToChatChannel,
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

    it('falls back to default seed messages when database has no messages for standard channel', async () => {
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
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].channel_id).toBe('batch-15-community');
    });

    it('falls back to seed messages gracefully if database query returns an error', async () => {
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
      expect(messages.length).toBeGreaterThan(0);
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
