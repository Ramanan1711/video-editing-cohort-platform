import { supabase } from './supabaseClient';

export interface CommunityPost {
  id: string;
  author_id: string;
  cohort_id: string | null;
  lesson_id: string | null;
  title: string | null;
  body: string;
  is_pinned: boolean;
  moderation_status: 'published' | 'flagged' | 'hidden';
  created_at: string;
  author_name?: string;
  author_role?: string;
  comment_count?: number;
  reactions?: Record<string, number>;
  user_reactions?: string[];
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name?: string;
  author_role?: string;
}

export interface ListCohortPostsParams {
  cohortId?: string | null;
  lessonId?: string;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedCommunityPosts {
  posts: CommunityPost[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export async function listCohortPosts(
  cohortId?: string,
  lessonId?: string,
  searchQuery?: string
): Promise<CommunityPost[]> {
  try {
    let query = supabase
      .from('community_posts')
      .select('id, author_id, cohort_id, lesson_id, title, body, is_pinned, moderation_status, created_at')
      .neq('moderation_status', 'hidden')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }
    if (lessonId) {
      query = query.eq('lesson_id', lessonId);
    }

    const { data: posts, error } = await query;
    if (error) {
      // Graceful fallback if cohort_id / is_pinned columns haven't been migrated yet
      const fallback = await supabase
        .from('community_posts')
        .select('id, author_id, body, created_at')
        .order('created_at', { ascending: false });

      if (fallback.error) throw error;

      return (fallback.data ?? []).map((p) => ({
        id: p.id,
        author_id: p.author_id,
        cohort_id: null,
        lesson_id: null,
        title: null,
        body: p.body,
        is_pinned: false,
        moderation_status: 'published',
        created_at: p.created_at,
        comment_count: 0,
        reactions: {},
        user_reactions: [],
      }));
    }

    if (!posts || posts.length === 0) return [];

    // Filter by search query if provided
    let filtered = posts as CommunityPost[];
    if (searchQuery?.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.title && p.title.toLowerCase().includes(q)) ||
          p.body.toLowerCase().includes(q)
      );
    }

    // Fetch author profiles
    const authorIds = Array.from(new Set(filtered.map((p) => p.author_id)));
    const { data: profiles } = authorIds.length
      ? await supabase.from('profiles').select('id, full_name, role').in('id', authorIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Fetch comment counts
    const postIds = filtered.map((p) => p.id);
    const { data: comments } = postIds.length
      ? await supabase.from('community_comments').select('id, post_id').in('post_id', postIds)
      : { data: [] };

    const commentCountMap = new Map<string, number>();
    for (const c of comments ?? []) {
      commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) || 0) + 1);
    }

    // Fetch reactions
    let reactionMap = new Map<string, Record<string, number>>();
    let userReactionMap = new Map<string, string[]>();

    try {
      const { data: reactions } = postIds.length
        ? await supabase.from('community_reactions').select('post_id, user_id, emoji').in('post_id', postIds)
        : { data: [] };

      const { data: authUser } = await supabase.auth.getUser();
      const currentUserId = authUser?.user?.id;

      for (const r of reactions ?? []) {
        const counts = reactionMap.get(r.post_id) || {};
        counts[r.emoji] = (counts[r.emoji] || 0) + 1;
        reactionMap.set(r.post_id, counts);

        if (currentUserId && r.user_id === currentUserId) {
          const userEmojis = userReactionMap.get(r.post_id) || [];
          userEmojis.push(r.emoji);
          userReactionMap.set(r.post_id, userEmojis);
        }
      }
    } catch {
      reactionMap = new Map();
      userReactionMap = new Map();
    }

    return filtered.map((p) => {
      const author = profileMap.get(p.author_id);
      return {
        ...p,
        author_name: author?.full_name || 'Community Member',
        author_role: author?.role || 'student',
        comment_count: commentCountMap.get(p.id) || 0,
        reactions: reactionMap.get(p.id) || {},
        user_reactions: userReactionMap.get(p.id) || [],
      };
    });
  } catch (err) {
    console.warn('Failed to load community posts:', err);
    return [];
  }
}

export async function listCohortPostsPaged(
  params: ListCohortPostsParams = {}
): Promise<PagedCommunityPosts> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? 10);

  const allPosts = await listCohortPosts(
    params.cohortId || undefined,
    params.lessonId,
    params.searchQuery
  );

  const totalCount = allPosts.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = (page - 1) * pageSize;
  const posts = allPosts.slice(from, from + pageSize);

  return {
    posts,
    totalCount,
    totalPages,
    page,
    pageSize,
  };
}

export async function createCommunityPost(
  authorId: string,
  body: string,
  cohortId?: string | null,
  lessonId?: string | null,
  title?: string | null,
  isPinned?: boolean
): Promise<CommunityPost> {
  const payload: Record<string, unknown> = {
    author_id: authorId,
    body: body.trim(),
  };
  if (cohortId) payload.cohort_id = cohortId;
  if (lessonId) payload.lesson_id = lessonId;
  if (title?.trim()) payload.title = title.trim();
  if (typeof isPinned === 'boolean') payload.is_pinned = isPinned;

  const res = await supabase.from('community_posts').insert(payload).select().single();
  let data = res.data;
  const error = res.error;

  if (error && (error.message.includes('cohort_id') || error.message.includes('title'))) {
    // Fallback for unmigrated schema
    const fallback = await supabase
      .from('community_posts')
      .insert({ author_id: authorId, body: body.trim() })
      .select()
      .single();
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  } else if (error) {
    throw error;
  }

  return {
    ...(data as CommunityPost),
    comment_count: 0,
    reactions: {},
    user_reactions: [],
  };
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  const { error } = await supabase.from('community_posts').delete().eq('id', postId);
  if (error) throw error;
}

export async function listCommunityComments(postId: string): Promise<CommunityComment[]> {
  try {
    const { data: comments, error } = await supabase
      .from('community_comments')
      .select('id, post_id, author_id, body, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!comments || comments.length === 0) return [];

    const authorIds = Array.from(new Set(comments.map((c) => c.author_id)));
    const { data: profiles } = authorIds.length
      ? await supabase.from('profiles').select('id, full_name, role').in('id', authorIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return comments.map((c) => {
      const author = profileMap.get(c.author_id);
      return {
        ...c,
        author_name: author?.full_name || 'Member',
        author_role: author?.role || 'student',
      };
    });
  } catch (err) {
    console.warn('Failed to load community comments:', err);
    return [];
  }
}

export async function addCommunityComment(
  postId: string,
  authorId: string,
  body: string
): Promise<CommunityComment> {
  const { data, error } = await supabase
    .from('community_comments')
    .insert({ post_id: postId, author_id: authorId, body: body.trim() })
    .select('id, post_id, author_id, body, created_at')
    .single();

  if (error) throw error;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', authorId)
    .maybeSingle();

  return {
    ...(data as CommunityComment),
    author_name: profile?.full_name || 'You',
    author_role: profile?.role || 'student',
  };
}

export async function togglePostReaction(
  postId: string,
  userId: string,
  emoji: string
): Promise<{ added: boolean }> {
  try {
    const { data: existing } = await supabase
      .from('community_reactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      await supabase.from('community_reactions').delete().eq('id', existing.id);
      return { added: false };
    } else {
      await supabase.from('community_reactions').insert({
        post_id: postId,
        user_id: userId,
        emoji,
      });
      return { added: true };
    }
  } catch (err) {
    console.warn('Reactions table unavailable:', err);
    return { added: false };
  }
}

export async function reportCommunityPost(
  postId: string,
  reporterId: string,
  reason: string
): Promise<void> {
  try {
    const { error } = await supabase.from('community_reports').insert({
      post_id: postId,
      reporter_id: reporterId,
      reason: reason.trim(),
    });
    if (error) throw error;
  } catch (err) {
    console.warn('community_reports table unavailable, logging report intent:', err);
  }
}

export function subscribeToCohortCommunity(
  cohortId?: string | null,
  onUpdate?: () => void
): () => void {
  const channelName = cohortId ? `cohort-community-${cohortId}` : 'cohort-community-all';
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'community_posts' },
      () => {
        if (onUpdate) onUpdate();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'community_comments' },
      () => {
        if (onUpdate) onUpdate();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'community_reactions' },
      () => {
        if (onUpdate) onUpdate();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
