import { supabase } from './supabaseClient';

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'student' | 'mentor' | 'admin' | 'creator';
  sender_avatar?: string;
  content: string;
  created_at: string;
  reactions?: Record<string, number>;
  attachment_url?: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  category: 'cohort' | 'squad' | 'vip' | 'direct';
  unread_count?: number;
  is_locked?: boolean;
  cohort_id?: string;
  icon?: string;
}

export interface DirectMessageUser {
  id: string;
  name: string;
  role: 'student' | 'mentor' | 'admin';
  avatar?: string;
  online: boolean;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

// Initial mock channels matching the reference screenshot
export const DEFAULT_CHANNELS: ChatChannel[] = [
  {
    id: 'batch-15-community',
    name: 'Batch 15 Community',
    description: 'Main discussion hub for all Batch 15 video editing students and mentors.',
    category: 'cohort',
    unread_count: 0,
    icon: '🔥',
  },
  {
    id: 'batch-15-qa',
    name: '!? Q&A',
    description: 'Ask editing, Premiere, DaVinci, sound design, and color grading questions.',
    category: 'cohort',
    unread_count: 16,
    icon: '⁉️',
  },
  {
    id: 'batch-15-blue-squad',
    name: 'B15 Blue Squad',
    description: 'Small group accountability circle for feedback, pacing, and daily edits.',
    category: 'squad',
    unread_count: 0,
    icon: '🔷',
  },
  {
    id: 'top-1-chat-room',
    name: 'Chat Room',
    description: 'Exclusive lounge for Top 1% cohort performers and portfolio standouts.',
    category: 'vip',
    is_locked: true,
    icon: '🔥',
  },
];

export const DEFAULT_DIRECT_MESSAGES: DirectMessageUser[] = [
  {
    id: 'mentor-shibin',
    name: 'Shibin (Lead Mentor)',
    role: 'mentor',
    online: true,
    last_message: 'Your pacing on the Week 2 cut looks razor sharp! Great work.',
    last_message_time: '10m ago',
    unread_count: 1,
  },
  {
    id: 'admin-pro-editors',
    name: 'Pro Editors Support',
    role: 'admin',
    online: true,
    last_message: 'Workshops calendar has been updated with Wednesday live critique.',
    last_message_time: '2h ago',
    unread_count: 1,
  },
  {
    id: 'peer-thilak',
    name: 'Thilak (Batch 15)',
    role: 'student',
    online: false,
    last_message: 'Hey, what plugin did you use for the film grain transition?',
    last_message_time: 'Yesterday',
    unread_count: 0,
  },
];

// Seed initial chat messages for realistic interactive experience
const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  'batch-15-community': [
    {
      id: 'msg-1',
      channel_id: 'batch-15-community',
      sender_id: 'system-cut-craft',
      sender_name: 'CUT / CRAFT',
      sender_role: 'creator',
      content: 'Welcome to Batch 15! Share your intro and current editing workstation below 🚀',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'msg-2',
      channel_id: 'batch-15-community',
      sender_id: 'peer-thilak',
      sender_name: 'Thilak',
      sender_role: 'student',
      content: 'Excited to be here! Working on Premiere Pro 2026 with an M3 Max.',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'msg-3',
      channel_id: 'batch-15-community',
      sender_id: 'mentor-shibin',
      sender_name: 'Shibin',
      sender_role: 'mentor',
      content: 'Don’t forget to check the Leaderboard announcement in the Feed! Week 2 submissions were fire 🔥',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ],
  'batch-15-qa': [
    {
      id: 'msg-qa-1',
      channel_id: 'batch-15-qa',
      sender_id: 'student-meshak',
      sender_name: 'Meshak',
      sender_role: 'student',
      content: 'Quick question: What is the optimal export bitrate for vertical YouTube Shorts vs Instagram Reels in 4K?',
      created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    },
    {
      id: 'msg-qa-2',
      channel_id: 'batch-15-qa',
      sender_id: 'mentor-shibin',
      sender_name: 'Shibin',
      sender_role: 'mentor',
      content: 'Target 35-40 Mbps VBR 2-Pass for 4K vertical exports to prevent platform recompression artifacts.',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
  ],
  'batch-15-blue-squad': [
    {
      id: 'msg-squad-1',
      channel_id: 'batch-15-blue-squad',
      sender_id: 'student-meshak',
      sender_name: 'Meshak',
      sender_role: 'student',
      content: 'Blue squad sync at 7 PM IST today! Who is ready with their rough cuts?',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ],
  'mentor-shibin': [
    {
      id: 'dm-1',
      channel_id: 'mentor-shibin',
      sender_id: 'mentor-shibin',
      sender_name: 'Shibin',
      sender_role: 'mentor',
      content: 'Hey! Loved your color grading on the commercial challenge.',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'dm-2',
      channel_id: 'mentor-shibin',
      sender_id: 'mentor-shibin',
      sender_name: 'Shibin',
      sender_role: 'mentor',
      content: 'Your pacing on the Week 2 cut looks razor sharp! Great work.',
      created_at: new Date(Date.now() - 600000).toISOString(),
    },
  ],
};

// Purge deprecated unverified localStorage chat cache if present
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('video_editing_community_messages_v1');
  }
} catch {
  // Ignore environments without localStorage access
}

/**
 * List messages for a specific channel or direct message thread.
 * Queries public.community_messages with static fallback to seed messages for empty standard channels.
 */
export async function listChannelMessages(channelId: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('community_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      if (data.length > 0) {
        return data as ChatMessage[];
      }
      // If table exists but has no records for this channel, provide default seed messages for standard channels
      return INITIAL_MESSAGES[channelId] || [];
    }

    if (error) {
      console.warn(`Failed to fetch community messages for channel ${channelId}:`, error.message);
    }
  } catch (err: unknown) {
    console.warn('Error querying community messages:', err);
  }

  // Fallback to static seed messages for predefined channels (read-only)
  return INITIAL_MESSAGES[channelId] || [];
}

/**
 * Send a message to a channel or direct message thread.
 * Authoritative: writes directly to public.community_messages in Supabase.
 * Fails closed if the database write is rejected (e.g. RLS policy violation or network failure),
 * preventing false illusion of delivery.
 */
export async function sendChatMessage(
  channelId: string,
  sender: {
    id: string;
    name: string;
    role: 'student' | 'mentor' | 'admin' | 'creator';
    avatar?: string;
  },
  content: string
): Promise<ChatMessage> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Message content cannot be empty.');
  }

  if (!sender.id) {
    throw new Error('Authentication required: valid sender profile ID is required to send messages.');
  }

  const { data, error } = await supabase
    .from('community_messages')
    .insert({
      channel_id: channelId,
      sender_id: sender.id,
      sender_name: sender.name,
      sender_role: sender.role,
      sender_avatar: sender.avatar,
      content: trimmed,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to post community message to Supabase:', error);
    throw new Error(error.message || 'Failed to deliver message to community.');
  }

  if (!data) {
    throw new Error('No message response received from server.');
  }

  return data as ChatMessage;
}

/**
 * Subscribes to real-time chat updates via Supabase Realtime postgres_changes.
 */
export function subscribeToChatChannel(
  channelId: string,
  onNewMessage: (msg: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`chat-${channelId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'community_messages',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        if (payload.new) {
          onNewMessage(payload.new as ChatMessage);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

