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

// Baseline empty arrays - zero hardcoded mock data
export const DEFAULT_CHANNELS: ChatChannel[] = [];
export const DEFAULT_DIRECT_MESSAGES: DirectMessageUser[] = [];

// Purge deprecated unverified localStorage chat cache if present
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('video_editing_community_messages_v1');
  }
} catch {
  // Ignore environments without localStorage access
}

/**
 * Dynamically fetches chat channels from Supabase cohorts and active community message threads.
 * Strictly queries live database state with zero hardcoded channels.
 */
export async function fetchChatChannels(): Promise<ChatChannel[]> {
  const channelMap = new Map<string, ChatChannel>();

  try {
    // 1. Discover channels from existing cohorts in database
    const { data: cohorts, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, title, description, status')
      .order('created_at', { ascending: false });

    if (!cohortError && cohorts && cohorts.length > 0) {
      for (const cohort of cohorts) {
        const cohortTitle = cohort.title || 'Cohort';
        const commId = `${cohort.id}-community`;
        channelMap.set(commId, {
          id: commId,
          cohort_id: cohort.id,
          name: `${cohortTitle} Community`,
          description: cohort.description || `Main discussion hub for ${cohortTitle}`,
          category: 'cohort',
          unread_count: 0,
          icon: '🔥',
        });

        const qaId = `${cohort.id}-qa`;
        channelMap.set(qaId, {
          id: qaId,
          cohort_id: cohort.id,
          name: `!? Q&A - ${cohortTitle}`,
          description: `Questions, editing troubleshooting, and workflow help for ${cohortTitle}`,
          category: 'cohort',
          unread_count: 0,
          icon: '⁉️',
        });

        const squadId = `${cohort.id}-squad`;
        channelMap.set(squadId, {
          id: squadId,
          cohort_id: cohort.id,
          name: `${cohortTitle} Squad`,
          description: `Small group accountability circle for ${cohortTitle}`,
          category: 'squad',
          unread_count: 0,
          icon: '🔷',
        });
      }
    } else if (cohortError) {
      console.warn('Failed to fetch cohorts for chat channels:', cohortError.message);
    }

    // 2. Discover channels actively present in community_messages
    const { data: messageChannels, error: msgError } = await supabase
      .from('community_messages')
      .select('channel_id')
      .limit(100);

    if (!msgError && messageChannels) {
      for (const row of messageChannels) {
        const chId = row.channel_id;
        if (chId && !channelMap.has(chId) && !chId.startsWith('dm-')) {
          const formattedName = chId
            .split('-')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          channelMap.set(chId, {
            id: chId,
            name: formattedName,
            description: `Community channel for ${formattedName}`,
            category: chId.includes('squad') ? 'squad' : chId.includes('vip') || chId.includes('top-1') ? 'vip' : 'cohort',
            unread_count: 0,
            icon: chId.includes('qa') ? '⁉️' : chId.includes('squad') ? '🔷' : '🔥',
          });
        }
      }
    }
  } catch (err: unknown) {
    console.warn('Error fetching dynamic chat channels:', err);
  }

  return Array.from(channelMap.values());
}

/**
 * Dynamically fetches direct message users from public.public_profiles or public.profiles.
 * Strictly queries live authenticated database profiles with zero hardcoded contacts.
 */
export async function fetchDirectMessageUsers(currentUserId?: string): Promise<DirectMessageUser[]> {
  try {
    let query = supabase
      .from('public_profiles')
      .select('id, full_name, role, avatar_url');

    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    const { data, error } = await query
      .order('full_name', { ascending: true })
      .limit(50);

    if (!error && data) {
      return data.map((profile) => ({
        id: profile.id,
        name: profile.full_name || 'Community Member',
        role: (profile.role === 'mentor' || profile.role === 'admin' ? profile.role : 'student') as 'student' | 'mentor' | 'admin',
        avatar: profile.avatar_url || undefined,
        online: false,
        unread_count: 0,
      }));
    }

    if (error) {
      console.warn('Failed to query public_profiles, trying profiles table:', error.message);
      let fallbackQuery = supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url');

      if (currentUserId) {
        fallbackQuery = fallbackQuery.neq('id', currentUserId);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery
        .order('full_name', { ascending: true })
        .limit(50);

      if (!fallbackError && fallbackData) {
        return fallbackData.map((profile) => ({
          id: profile.id,
          name: profile.full_name || 'Community Member',
          role: (profile.role === 'mentor' || profile.role === 'admin' ? profile.role : 'student') as 'student' | 'mentor' | 'admin',
          avatar: profile.avatar_url || undefined,
          online: false,
          unread_count: 0,
        }));
      }
    }
  } catch (err: unknown) {
    console.warn('Error fetching dynamic direct message users:', err);
  }

  return [];
}

/**
 * List messages for a specific channel or direct message thread.
 * Authoritative: strictly queries public.community_messages with zero hardcoded mock data.
 * Returns empty array if no records exist in the database or on query failure.
 */
export async function listChannelMessages(channelId: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('community_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      return data as ChatMessage[];
    }

    if (error) {
      console.warn(`Failed to fetch community messages for channel ${channelId}:`, error.message);
    }
  } catch (err: unknown) {
    console.warn('Error querying community messages:', err);
  }

  return [];
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
