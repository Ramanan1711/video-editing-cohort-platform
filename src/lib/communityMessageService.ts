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

interface CohortRow {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
}

/**
 * Helper to retrieve cohort IDs the user is enrolled in (or assigned to as mentor).
 */
export async function getUserEnrolledCohortIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const cohortIds = new Set<string>();

    // 1. Student enrollments in active/enrolled/completed/inactive status
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('cohort_id')
      .eq('user_id', userId)
      .in('status', ['enrolled', 'active', 'completed', 'inactive']);

    if (!enrollError && enrollments) {
      for (const e of enrollments) {
        if (e.cohort_id) cohortIds.add(e.cohort_id);
      }
    }

    // 2. Mentor cohort assignments
    const { data: mentorCohorts, error: mentorError } = await supabase
      .from('mentor_cohorts')
      .select('cohort_id')
      .eq('mentor_id', userId);

    if (!mentorError && mentorCohorts) {
      for (const m of mentorCohorts) {
        if (m.cohort_id) cohortIds.add(m.cohort_id);
      }
    }

    return Array.from(cohortIds);
  } catch (err: unknown) {
    console.warn('Error fetching user enrolled cohort IDs:', err);
    return [];
  }
}

/**
 * Dynamically fetches chat channels from Supabase cohorts strictly according to the courses
 * enrolled by the user. If userId is provided, non-enrolled cohort channels are not displayed.
 */
export async function fetchChatChannels(userId?: string): Promise<ChatChannel[]> {
  const channelMap = new Map<string, ChatChannel>();

  try {
    // When userId is provided, scope strictly to courses enrolled by the user
    let enrolledCohortIds: string[] | null = null;
    if (userId) {
      enrolledCohortIds = await getUserEnrolledCohortIds(userId);

      if (enrolledCohortIds.length === 0) {
        // If not enrolled in any cohorts, check if user is an admin supervising all cohorts
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        if (profile?.role !== 'admin') {
          // Regular student/mentor with zero enrollments sees no enrolled channels
          return [];
        }
      }
    }

    let cohortQuery = supabase
      .from('cohorts')
      .select('id, title, name, description, status');

    if (enrolledCohortIds && enrolledCohortIds.length > 0) {
      cohortQuery = cohortQuery.in('id', enrolledCohortIds);
    }

    let cohorts: CohortRow[] | null = null;
    let cohortError: { message: string } | null = null;

    const res = await cohortQuery.order('created_at', { ascending: false });
    if (!res.error && res.data) {
      cohorts = res.data as unknown as CohortRow[];
    } else if (res.error) {
      cohortError = res.error;
    }

    // Fallback if 'name' or 'status' column doesn't exist in a stripped view or test mock
    if (cohortError) {
      let fallbackQuery = supabase
        .from('cohorts')
        .select('id, title, description');

      if (enrolledCohortIds && enrolledCohortIds.length > 0) {
        fallbackQuery = fallbackQuery.in('id', enrolledCohortIds);
      }

      const fallbackRes = await fallbackQuery.order('created_at', { ascending: false });
      if (!fallbackRes.error && fallbackRes.data) {
        cohorts = fallbackRes.data as unknown as CohortRow[];
        cohortError = null;
      }
    }

    if (!cohortError && cohorts && cohorts.length > 0) {
      for (const cohort of cohorts as unknown as CohortRow[]) {
        const rawTitle = cohort.title || cohort.name;
        const cohortTitle = (rawTitle && String(rawTitle).trim()) || 'Cohort';
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
  } catch (err: unknown) {
    console.warn('Error fetching dynamic chat channels:', err);
  }

  return Array.from(channelMap.values());
}

/**
 * Dynamically fetches direct message users according to courses enrolled by the user.
 * Scopes contacts strictly to peer students and mentors affiliated with the user's enrolled cohorts.
 */
export async function fetchDirectMessageUsers(currentUserId?: string): Promise<DirectMessageUser[]> {
  try {
    let candidateUserIds: string[] | null = null;

    if (currentUserId) {
      const enrolledCohortIds = await getUserEnrolledCohortIds(currentUserId);

      if (enrolledCohortIds.length === 0) {
        // If not enrolled in any cohorts, check if user is an admin supervising all cohorts
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUserId)
          .maybeSingle();

        if (profile?.role !== 'admin') {
          return [];
        }
      } else {
        const targetIds = new Set<string>();

        // 1. Peer students enrolled in the same cohorts
        const { data: peers } = await supabase
          .from('enrollments')
          .select('user_id')
          .in('cohort_id', enrolledCohortIds)
          .neq('user_id', currentUserId)
          .in('status', ['enrolled', 'active', 'completed', 'inactive']);

        if (peers) {
          for (const p of peers) {
            if (p.user_id) targetIds.add(p.user_id);
          }
        }

        // 2. Mentors assigned to the same cohorts
        const { data: mentors } = await supabase
          .from('mentor_cohorts')
          .select('mentor_id')
          .in('cohort_id', enrolledCohortIds)
          .neq('mentor_id', currentUserId);

        if (mentors) {
          for (const m of mentors) {
            if (m.mentor_id) targetIds.add(m.mentor_id);
          }
        }

        if (targetIds.size === 0) {
          return [];
        }

        candidateUserIds = Array.from(targetIds);
      }
    }

    let query = supabase
      .from('public_profiles')
      .select('id, full_name, role, avatar_url');

    if (candidateUserIds) {
      query = query.in('id', candidateUserIds);
    } else if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    const { data, error } = await query
      .order('full_name', { ascending: true })
      .limit(100);

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

      if (candidateUserIds) {
        fallbackQuery = fallbackQuery.in('id', candidateUserIds);
      } else if (currentUserId) {
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
      return (data as Array<Record<string, unknown>>).map((row) => {
        const item: ChatMessage = {
          id: String(row.id),
          channel_id: String(row.channel_id),
          sender_id: String(row.sender_id || row.author_id || ''),
          sender_name: String(row.sender_name || 'Community Member'),
          sender_role: ((row.sender_role || 'student') as 'student' | 'mentor' | 'admin' | 'creator'),
          content: String(row.content || row.body || row.message || ''),
          created_at: String(row.created_at || new Date().toISOString()),
        };
        if (row.sender_avatar) item.sender_avatar = row.sender_avatar as string;
        if (row.reactions) item.reactions = row.reactions as Record<string, number>;
        if (row.attachment_url) item.attachment_url = row.attachment_url as string;
        return item;
      });
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

  // Include both sender_id / author_id and content / body to satisfy different schema variants
  const payload: Record<string, unknown> = {
    channel_id: channelId,
    sender_id: sender.id,
    author_id: sender.id,
    sender_name: sender.name,
    sender_role: sender.role,
    sender_avatar: sender.avatar,
    content: trimmed,
    body: trimmed,
  };

  let { data, error } = await supabase
    .from('community_messages')
    .insert(payload)
    .select()
    .single();

  // Resilience: if database schema does not have body / content / author_id / sender_id (42703 / PGRST204)
  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    const errorMsg = error.message || '';
    if (errorMsg.includes('body')) delete payload.body;
    if (errorMsg.includes('content')) delete payload.content;
    if (errorMsg.includes('author_id')) delete payload.author_id;
    if (errorMsg.includes('sender_id')) delete payload.sender_id;

    const retryRes = await supabase
      .from('community_messages')
      .insert(payload)
      .select()
      .single();

    data = retryRes.data;
    error = retryRes.error;
  }

  // Resilience: if database schema enforces a NOT NULL constraint on body or author_id (23502)
  if (error && error.code === '23502') {
    const errorMsg = error.message || '';
    if (errorMsg.includes('body')) payload.body = trimmed;
    if (errorMsg.includes('content')) payload.content = trimmed;
    if (errorMsg.includes('author_id')) payload.author_id = sender.id;
    if (errorMsg.includes('sender_id')) payload.sender_id = sender.id;

    const retryRes = await supabase
      .from('community_messages')
      .insert(payload)
      .select()
      .single();

    data = retryRes.data;
    error = retryRes.error;
  }

  if (error) {
    console.error('Failed to post community message to Supabase:', error);
    throw new Error(error.message || 'Failed to deliver message to community.');
  }

  if (!data) {
    throw new Error('No message response received from server.');
  }

  const row = data as Record<string, unknown>;
  const result: ChatMessage = {
    id: String(row.id),
    channel_id: String(row.channel_id),
    sender_id: String(row.sender_id || row.author_id || sender.id),
    sender_name: String(row.sender_name || sender.name),
    sender_role: ((row.sender_role || sender.role) as 'student' | 'mentor' | 'admin' | 'creator'),
    content: String(row.content || row.body || trimmed),
    created_at: String(row.created_at || new Date().toISOString()),
  };
  if (row.sender_avatar || sender.avatar) {
    result.sender_avatar = (row.sender_avatar as string) || sender.avatar;
  }
  if (row.reactions) {
    result.reactions = row.reactions as Record<string, number>;
  }
  if (row.attachment_url) {
    result.attachment_url = row.attachment_url as string;
  }
  return result;
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
          const row = payload.new as Record<string, unknown>;
          const msg: ChatMessage = {
            id: String(row.id),
            channel_id: String(row.channel_id),
            sender_id: String(row.sender_id || row.author_id || ''),
            sender_name: String(row.sender_name || 'Community Member'),
            sender_role: ((row.sender_role || 'student') as 'student' | 'mentor' | 'admin' | 'creator'),
            content: String(row.content || row.body || ''),
            created_at: String(row.created_at || new Date().toISOString()),
          };
          if (row.sender_avatar) msg.sender_avatar = row.sender_avatar as string;
          if (row.reactions) msg.reactions = row.reactions as Record<string, number>;
          if (row.attachment_url) msg.attachment_url = row.attachment_url as string;
          onNewMessage(msg);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
