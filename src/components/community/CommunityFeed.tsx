import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SlidersHorizontal,
  Pin,
  Heart,
  MessageSquare,
  Eye,
  Share2,
  MoreHorizontal,
  Send,
  Sparkles,
  Trash2,
  Plus,
  Loader2,
} from 'lucide-react';
import { LeaderboardCard } from './LeaderboardCard';
import { PostMediaRenderer } from './PostMediaRenderer';
import { useAuth } from '../../context/useAuth';
import {
  listCohortPosts,
  listCommunityComments,
  addCommunityComment,
  deleteCommunityComment,
  deleteCommunityPost,
  togglePostReaction,
  togglePinCommunityPost,
  getCommunityPostViews,
  incrementCommunityPostViews,
  isValidUuid,
  type CommunityPost,
  type CommunityComment,
} from '../../lib/communityService';

interface CommunityFeedProps {
  onOpenCreateModal: () => void;
  cohortId?: string;
  selectedChannelId?: string;
  refreshKey?: number;
}

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  onOpenCreateModal,
  cohortId,
  selectedChannelId,
  refreshKey = 0,
}) => {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<'all' | 'pinned' | 'qa' | 'media'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Interaction State
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [likesCountMap, setLikesCountMap] = useState<Record<string, number>>({});
  const [viewsCountMap, setViewsCountMap] = useState<Record<string, number>>({});
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());

  // Comments State
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, CommunityComment[]>>({});
  const [loadingCommentsMap, setLoadingCommentsMap] = useState<Record<string, boolean>>({});
  const [newCommentTextMap, setNewCommentTextMap] = useState<Record<string, string>>({});

  // Menu Dropdown State
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  // Toast State
  const [shareToast, setShareToast] = useState(false);
  const viewedPostsSession = useRef<Set<string>>(new Set());

  const canManagePins = useMemo(() => {
    return profile?.role === 'admin' || profile?.role === 'mentor';
  }, [profile?.role]);

  // Load purely dynamic posts from database
  useEffect(() => {
    let active = true;
    setLoading(true);

    const targetCohortId = isValidUuid(cohortId)
      ? cohortId
      : isValidUuid(selectedChannelId)
      ? selectedChannelId
      : undefined;

    listCohortPosts(targetCohortId)
      .then((data) => {
        if (!active) return;
        setPosts(data);

        // Populate initial likes and user reactions
        const liked = new Set<string>();
        const counts: Record<string, number> = {};
        const views: Record<string, number> = {};

        for (const post of data) {
          const userHasLiked =
            post.user_reactions?.includes('❤️') ||
            post.user_reactions?.includes('like');
          if (userHasLiked) {
            liked.add(post.id);
          }

          const totalLikes =
            (post.reactions?.['❤️'] || 0) +
            (post.reactions?.['like'] || 0);
          counts[post.id] = totalLikes;

          const baseViews = getCommunityPostViews(post.id, post.created_at, post.views_count);
          if (!viewedPostsSession.current.has(post.id)) {
            viewedPostsSession.current.add(post.id);
            views[post.id] = incrementCommunityPostViews(post.id);
          } else {
            views[post.id] = baseViews;
          }
        }

        setLikedPostIds(liked);
        setLikesCountMap(counts);
        setViewsCountMap(views);
      })
      .catch((err) => {
        console.warn('Failed to load community feed:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cohortId, selectedChannelId, refreshKey]);

  // Toggle Like on any post
  const handleToggleLike = async (postId: string) => {
    if (!user) {
      alert('Please sign in to like community posts');
      return;
    }

    const isCurrentlyLiked = likedPostIds.has(postId);

    // Optimistic UI update
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });

    setLikesCountMap((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] || 0) + (isCurrentlyLiked ? -1 : 1)),
    }));

    try {
      await togglePostReaction(postId, user.id, '❤️');
    } catch (err) {
      console.warn('Failed to toggle like on server:', err);
      // Rollback
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setLikesCountMap((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] || 0) + (isCurrentlyLiked ? 1 : -1)),
      }));
    }
  };

  // Toggle Comments Drawer on any post
  const handleToggleComments = async (postId: string) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      return;
    }

    setActiveCommentsPostId(postId);

    if (!commentsMap[postId]) {
      setLoadingCommentsMap((prev) => ({ ...prev, [postId]: true }));
      try {
        const comms = await listCommunityComments(postId);
        setCommentsMap((prev) => ({ ...prev, [postId]: comms }));
      } catch (err) {
        console.warn('Failed to fetch comments:', err);
      } finally {
        setLoadingCommentsMap((prev) => ({ ...prev, [postId]: false }));
      }
    }
  };

  // Add Comment on any post
  const handleAddComment = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    const text = (newCommentTextMap[postId] || '').trim();
    if (!text || !user) return;

    setNewCommentTextMap((prev) => ({ ...prev, [postId]: '' }));

    try {
      const newComment = await addCommunityComment(postId, user.id, text);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p
        )
      );
    } catch (err) {
      console.error('Failed to post comment:', err);
    }
  };

  // Delete Comment
  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;

    setCommentsMap((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
    }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count || 1) - 1) } : p
      )
    );

    try {
      await deleteCommunityComment(commentId);
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Toggle Pin on any post
  const handleTogglePin = async (postId: string, currentPinStatus: boolean) => {
    const newPinStatus = !currentPinStatus;

    setPosts((prev) => {
      const updated = prev.map((p) =>
        p.id === postId ? { ...p, is_pinned: newPinStatus } : p
      );
      return [...updated].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
    });

    setOpenMenuPostId(null);

    try {
      await togglePinCommunityPost(postId, newPinStatus);
    } catch (err) {
      console.error('Failed to update pin status:', err);
      // Revert
      setPosts((prev) => {
        const updated = prev.map((p) =>
          p.id === postId ? { ...p, is_pinned: currentPinStatus } : p
        );
        return [...updated].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
      });
    }
  };

  // Share post link
  const handleSharePost = async (post: CommunityPost) => {
    const shareUrl = `${window.location.origin}/community?post=${post.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title || 'Community Post',
          text: post.body?.slice(0, 100),
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
    }
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  // Delete post (author / admin)
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this community post?')) return;

    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setOpenMenuPostId(null);

    try {
      await deleteCommunityPost(postId);
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  // Toggle see more / see less
  const toggleExpandPost = (postId: string) => {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  // Filter posts
  const filteredPosts = useMemo(() => {
    if (filterType === 'pinned') {
      return posts.filter((p) => p.is_pinned);
    }
    if (filterType === 'qa') {
      return posts.filter(
        (p) =>
          (p.title && (p.title.includes('?') || p.title.toLowerCase().includes('q&a'))) ||
          p.body.includes('?')
      );
    }
    if (filterType === 'media') {
      return posts.filter((p) => Boolean(p.media_url));
    }
    return posts;
  }, [posts, filterType]);

  return (
    <div className="flex-1 overflow-y-auto w-full bg-white dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {shareToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles size={14} className="text-orange-400" />
          <span>Post link copied to clipboard!</span>
        </div>
      )}

      {/* Top Header & Filter Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            Community Feed
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Latest announcements, student projects, leaderboards &amp; discussions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCreateModal}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Create Post</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <SlidersHorizontal size={14} />
              <span className="capitalize">
                {filterType === 'all' ? 'All Posts' : filterType === 'qa' ? 'Q&A' : filterType}
              </span>
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-30">
                {(['all', 'pinned', 'qa', 'media'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setFilterType(type);
                      setShowFilterDropdown(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                      filterType === type
                        ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="capitalize">
                      {type === 'all'
                        ? 'All Posts'
                        : type === 'pinned'
                        ? 'Pinned Only'
                        : type === 'qa'
                        ? 'Q&A'
                        : 'With Media'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 animate-pulse space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-1.5">
                  <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-2.5 w-16 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredPosts.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-10 text-center space-y-4 bg-white/50 dark:bg-slate-900/40">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
            <MessageSquare size={22} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {filterType === 'pinned' ? 'No Pinned Posts' : 'No Community Posts Yet'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {filterType === 'pinned'
                ? 'Mentors and admins have not pinned any announcements to the top of this channel yet.'
                : 'Be the first to share your timeline cuts, ask questions, or post project updates!'}
            </p>
          </div>
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Create First Post</span>
          </button>
        </div>
      )}

      {/* Pure Dynamic Feed List */}
      {!loading &&
        filteredPosts.map((post) => {
          const isLiked = likedPostIds.has(post.id);
          const likesCount = likesCountMap[post.id] ?? 0;
          const viewsCount = viewsCountMap[post.id] ?? 24;
          const isCommentsOpen = activeCommentsPostId === post.id;
          const postComments = commentsMap[post.id] || [];
          const isLoadingComments = loadingCommentsMap[post.id] || false;
          const isExpanded = expandedPostIds.has(post.id);
          const shouldTruncate = post.body.length > 280;
          const displayedBody =
            shouldTruncate && !isExpanded
              ? `${post.body.slice(0, 280)}...`
              : post.body;

          const isAuthor = user?.id === post.author_id;
          const canDelete = isAuthor || profile?.role === 'admin';
          const authorRoleDisplay =
            post.author_role === 'admin'
              ? 'Admin'
              : post.author_role === 'mentor'
              ? 'Mentor'
              : post.author_role === 'creator'
              ? 'CREATOR'
              : 'Student';

          const isLeaderboardPost =
            post.media_type === 'leaderboard' ||
            (post.title && post.title.toLowerCase().includes('leaderboard'));

          return (
            <article
              key={post.id}
              className={`rounded-2xl border transition-all ${
                post.is_pinned
                  ? 'border-amber-400/40 bg-gradient-to-b from-amber-500/5 via-white to-white dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 shadow-md'
                  : 'border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs hover:shadow-sm'
              }`}
            >
              <div className="p-5 sm:p-6 space-y-4">
                {/* Header: Pinned Tag & Author Meta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    {post.is_pinned && (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-950/50 dark:border-amber-800/60 dark:text-amber-400">
                        <Pin size={12} className="fill-amber-600" />
                        <span>Pinned</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white font-black text-xs shadow-xs dark:from-orange-600 dark:to-amber-500 shrink-0">
                        {post.author_name?.slice(0, 2).toUpperCase() || 'CC'}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-slate-950 dark:text-white">
                            {post.author_name || 'Community Member'}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide uppercase ${
                              authorRoleDisplay === 'Admin'
                                ? 'bg-rose-500 text-white'
                                : authorRoleDisplay === 'Mentor' || authorRoleDisplay === 'CREATOR'
                                ? 'bg-orange-500 text-white'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {authorRoleDisplay}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatRelativeTime(post.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Options Menu & Quick Pin */}
                  <div className="relative flex items-center gap-1">
                    {/* Quick Pin Button for Admins & Mentors */}
                    {canManagePins && (
                      <button
                        type="button"
                        onClick={() => handleTogglePin(post.id, post.is_pinned)}
                        title={post.is_pinned ? 'Unpin post' : 'Pin to top of feed'}
                        className={`rounded-lg p-2 transition cursor-pointer ${
                          post.is_pinned
                            ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Pin size={16} className={post.is_pinned ? 'fill-amber-500' : ''} />
                      </button>
                    )}

                    {/* More Options Dropdown */}
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)
                      }
                      title="Post options"
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      <MoreHorizontal size={17} />
                    </button>

                    {openMenuPostId === post.id && (
                      <div className="absolute right-0 top-10 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-30 animate-in fade-in zoom-in-95 duration-100">
                        {canManagePins && (
                          <button
                            type="button"
                            onClick={() => handleTogglePin(post.id, post.is_pinned)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Pin size={14} className={post.is_pinned ? 'text-amber-500' : ''} />
                            <span>{post.is_pinned ? 'Unpin Post' : 'Pin to Top'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuPostId(null);
                            handleSharePost(post);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          <Share2 size={14} />
                          <span>Share Link</span>
                        </button>

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          >
                            <Trash2 size={14} />
                            <span>Delete Post</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Post Title */}
                {post.title && (
                  <h2 className="text-base font-extrabold text-slate-950 dark:text-white">
                    {post.title}
                  </h2>
                )}

                {/* Post Text Body with Truncation */}
                <div className="space-y-1.5">
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {displayedBody}
                  </p>
                  {shouldTruncate && (
                    <button
                      type="button"
                      onClick={() => toggleExpandPost(post.id)}
                      className="text-xs font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 cursor-pointer"
                    >
                      {isExpanded ? 'See less' : 'See more'}
                    </button>
                  )}
                </div>

                {/* Dynamic Leaderboard Graphic Card (when post is a leaderboard announcement) */}
                {isLeaderboardPost && (
                  <div className="pt-2">
                    <LeaderboardCard />
                  </div>
                )}

                {/* Media Renderer (Videos, Images, Files) */}
                {post.media_url && !isLeaderboardPost && (
                  <div className="pt-1">
                    <PostMediaRenderer
                      mediaUrl={post.media_url}
                      mediaType={post.media_type}
                      fileName={post.file_name}
                    />
                  </div>
                )}

                {/* ========================================================================= */}
                {/* INTERACTION BAR: LIKE, COMMENT, VIEW, SHARE (FOR ALL POSTS) */}
                {/* ========================================================================= */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-5 sm:gap-6">
                    {/* 1. Like Option */}
                    <button
                      type="button"
                      onClick={() => handleToggleLike(post.id)}
                      title={isLiked ? 'Unlike post' : 'Like post'}
                      className={`flex items-center gap-1.5 transition cursor-pointer ${
                        isLiked
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Heart
                        size={16}
                        className={isLiked ? 'fill-rose-500 text-rose-500' : ''}
                      />
                      <span>{likesCount}</span>
                    </button>

                    {/* 2. Comment Option */}
                    <button
                      type="button"
                      onClick={() => handleToggleComments(post.id)}
                      title="View & write comments"
                      className={`flex items-center gap-1.5 transition cursor-pointer ${
                        isCommentsOpen
                          ? 'text-orange-600 dark:text-orange-400 font-extrabold'
                          : 'hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <MessageSquare size={16} />
                      <span>{post.comment_count ?? postComments.length}</span>
                    </button>

                    {/* 3. View Option */}
                    <div
                      className="flex items-center gap-1.5 text-slate-400 select-none"
                      title="Total views"
                    >
                      <Eye size={16} />
                      <span>{viewsCount}</span>
                    </div>
                  </div>

                  {/* 4. Share Option */}
                  <button
                    type="button"
                    onClick={() => handleSharePost(post)}
                    title="Share post"
                    className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
                  >
                    <Share2 size={15} />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                </div>

                {/* ========================================================================= */}
                {/* DYNAMIC COMMENTS DRAWER */}
                {/* ========================================================================= */}
                {isCommentsOpen && (
                  <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Add Comment Input */}
                    <form
                      onSubmit={(e) => handleAddComment(e, post.id)}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={newCommentTextMap[post.id] || ''}
                        onChange={(e) =>
                          setNewCommentTextMap((prev) => ({
                            ...prev,
                            [post.id]: e.target.value,
                          }))
                        }
                        placeholder="Write a supportive comment or critique..."
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-orange-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white shadow-2xs"
                      />
                      <button
                        type="submit"
                        disabled={!newCommentTextMap[post.id]?.trim()}
                        className="flex items-center justify-center rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-black text-white hover:bg-orange-600 disabled:opacity-50 transition cursor-pointer"
                      >
                        <Send size={13} />
                      </button>
                    </form>

                    {/* Comments List */}
                    {isLoadingComments ? (
                      <div className="py-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        <span>Loading comments...</span>
                      </div>
                    ) : postComments.length === 0 ? (
                      <p className="py-2 text-center text-[11px] text-slate-400">
                        No comments yet. Start the conversation!
                      </p>
                    ) : (
                      <div className="space-y-2 pt-1 max-h-72 overflow-y-auto pr-1">
                        {postComments.map((comm) => {
                          const isCommentAuthor = user?.id === comm.author_id;
                          const canDeleteComment =
                            isCommentAuthor || profile?.role === 'admin';

                          return (
                            <div
                              key={comm.id}
                              className="rounded-xl bg-white p-3 border border-slate-100 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-1"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-slate-900 dark:text-white">
                                    {comm.author_name || 'Community Member'}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {comm.author_role || 'Student'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 text-[10px]">
                                    {formatRelativeTime(comm.created_at)}
                                  </span>
                                  {canDeleteComment && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteComment(post.id, comm.id)
                                      }
                                      title="Delete comment"
                                      className="text-slate-400 hover:text-rose-500 transition cursor-pointer"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {comm.body}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
    </div>
  );
};
