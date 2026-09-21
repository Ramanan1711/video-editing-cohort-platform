import { useEffect, useState } from 'react';
import {
  Flag,
  Heart,
  Lightbulb,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Send,
  Sparkles,
  ThumbsUp,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import {
  addCommunityComment,
  createCommunityPost,
  listCohortPosts,
  listCommunityComments,
  reportCommunityPost,
  subscribeToCohortCommunity,
  togglePostReaction,
  type CommunityComment,
  type CommunityPost,
} from '../lib/communityService';

interface CommunityBoardProps {
  userId: string;
  cohortId?: string | null;
  lessonId?: string;
  isInlineLesson?: boolean;
}

const EMOJI_LIST = [
  { emoji: '👍', icon: ThumbsUp, label: 'Agree' },
  { emoji: '❤️', icon: Heart, label: 'Love' },
  { emoji: '💡', icon: Lightbulb, label: 'Insight' },
  { emoji: '🔥', icon: Sparkles, label: 'Fire' },
];

export function CommunityBoard({
  userId,
  cohortId,
  lessonId,
  isInlineLesson = false,
}: CommunityBoardProps) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [creating, setCreating] = useState(false);

  // Expanded post comments
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommunityComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);

  // Report modal
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('Spam or inappropriate content');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    listCohortPosts(cohortId || undefined, lessonId, searchQuery)
      .then((data) => {
        if (active) {
          setPosts(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load community posts:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cohortId, lessonId, searchQuery, refreshKey]);

  // Real-time subscription to cohort community events
  useEffect(() => {
    const unsubscribe = subscribeToCohortCommunity(cohortId, () => {
      setRefreshKey((k) => k + 1);
    });
    return () => {
      unsubscribe();
    };
  }, [cohortId]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBody.trim()) return;
    setCreating(true);
    try {
      await createCommunityPost(
        userId,
        newBody.trim(),
        cohortId || undefined,
        lessonId,
        newTitle.trim() || undefined
      );
      setShowCreateModal(false);
      setNewTitle('');
      setNewBody('');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.warn('Failed to create post:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleComments = async (postId: string) => {
    if (expandedCommentsPostId === postId) {
      setExpandedCommentsPostId(null);
      return;
    }
    setExpandedCommentsPostId(postId);
    if (!commentsByPost[postId]) {
      const data = await listCommunityComments(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: data }));
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    setSubmittingComment(postId);
    try {
      const newComment = await addCommunityComment(postId, userId, text);
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p))
      );
    } catch (err) {
      console.warn('Failed to add comment:', err);
    } finally {
      setSubmittingComment(null);
    }
  };

  const handleReaction = async (postId: string, emoji: string) => {
    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const userReactions = new Set(p.user_reactions || []);
        const reactions = { ...(p.reactions || {}) };
        const hasReacted = userReactions.has(emoji);

        if (hasReacted) {
          userReactions.delete(emoji);
          reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
        } else {
          userReactions.add(emoji);
          reactions[emoji] = (reactions[emoji] || 0) + 1;
        }

        return {
          ...p,
          reactions,
          user_reactions: Array.from(userReactions),
        };
      })
    );

    await togglePostReaction(postId, userId, emoji);
  };

  const handleSendReport = async () => {
    if (!reportingPostId) return;
    await reportCommunityPost(reportingPostId, userId, reportReason);
    setReportSubmitted(true);
    setTimeout(() => {
      setReportingPostId(null);
      setReportSubmitted(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Board Header Toolbar */}
      {!isInlineLesson && (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Cohort Town Hall</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Community Discussions &amp; Q&amp;A</h2>
            <p className="mt-1 text-xs text-slate-500">
              Ask questions, exchange timeline critiques, share plugins, and learn with fellow editors.
            </p>
          </div>

          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> New Discussion Topic
          </Button>
        </div>
      )}

      {/* Search & Actions Strip */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={isInlineLesson ? "Search lesson discussions..." : "Search discussions..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs outline-none focus:border-orange-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-[10px] font-bold text-emerald-700 shadow-2xs">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Sync</span>
          </div>

          {isInlineLesson && (
            <Button size="sm" variant="secondary" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} /> Ask Question
            </Button>
          )}
        </div>
      </div>

      {/* Posts Stream */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white border border-slate-200/60" />
            ))}
          </div>
        ) : posts.length ? (
          posts.map((post) => {
            const isAuthorMentor = post.author_role === 'mentor' || post.author_role === 'admin';

            return (
              <Card
                key={post.id}
                className={`p-5 transition text-left ${
                  post.is_pinned ? 'border-orange-300 bg-orange-50/10' : 'hover:border-slate-300'
                }`}
              >
                {/* Pin Header */}
                {post.is_pinned && (
                  <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-orange-600">
                    <Pin size={12} className="rotate-45" />
                    <span>Pinned Announcement</span>
                  </div>
                )}

                {/* Author Info & Date */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                        isAuthorMentor
                          ? 'bg-orange-500 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {post.author_name?.charAt(0) || 'M'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-950">{post.author_name}</span>
                        {isAuthorMentor && (
                          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-orange-800">
                            {post.author_role === 'admin' ? 'Lead Admin' : 'Mentor'}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(post.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setReportingPostId(post.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Report post"
                  >
                    <Flag size={13} />
                  </button>
                </div>

                {/* Post Title & Body */}
                {post.title && <h3 className="mt-3 text-sm font-black text-slate-950">{post.title}</h3>}
                <p className="mt-2 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{post.body}</p>

                {/* Reaction Bar & Comments Toggle */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1.5">
                    {EMOJI_LIST.map(({ emoji, label }) => {
                      const count = post.reactions?.[emoji] || 0;
                      const hasReacted = post.user_reactions?.includes(emoji);

                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(post.id, emoji)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition ${
                            hasReacted
                              ? 'border border-orange-300 bg-orange-50 font-bold text-orange-800'
                              : 'border border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                          title={label}
                        >
                          <span>{emoji}</span>
                          {count > 0 && <span className="text-[10px] font-bold">{count}</span>}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handleToggleComments(post.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-950"
                  >
                    <MessageSquare size={13} className="text-orange-500" />
                    <span>
                      {post.comment_count ? `${post.comment_count} Comments` : 'Comment / Reply'}
                    </span>
                  </button>
                </div>

                {/* Expandable Comments Section */}
                {expandedCommentsPostId === post.id && (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(commentsByPost[post.id] || []).map((comment) => (
                        <div key={comment.id} className="rounded-xl bg-slate-50 p-2.5 text-xs">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold text-slate-800">{comment.author_name}</span>
                            <span>{new Date(comment.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
                        </div>
                      ))}
                    </div>

                    {/* New Comment Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Write a response..."
                        value={commentDrafts[post.id] || ''}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void handleAddComment(post.id);
                          }
                        }}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-orange-400"
                      />
                      <Button
                        size="sm"
                        disabled={!commentDrafts[post.id]?.trim() || submittingComment === post.id}
                        onClick={() => void handleAddComment(post.id)}
                      >
                        <Send size={12} />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        ) : (
          <Card className="p-10 text-center text-slate-400">
            <MessageSquare size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No community posts yet</p>
            <p className="mt-1 text-xs text-slate-400">
              {searchQuery ? 'Try clearing your search term.' : 'Be the first to ask a question or start a topic.'}
            </p>
            <Button size="sm" className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} /> Start Discussion
            </Button>
          </Card>
        )}
      </div>

      {/* New Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleCreatePost}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-950">
                {lessonId ? 'Ask Lesson Question' : 'Start Community Discussion'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                Topic Title (Optional)
                <input
                  type="text"
                  placeholder="e.g., How to handle J-cut audio overlap in fast dialogue?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-orange-400"
                />
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Question / Discussion Body <span className="text-red-500">*</span>
                <textarea
                  rows={4}
                  required
                  placeholder="Share details, timeline timestamps, or editing techniques..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-orange-400 resize-none"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="secondary" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={creating}>
                <Send size={14} /> Post Discussion
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Report Modal */}
      {reportingPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <Flag size={16} />
                <h3 className="text-sm font-black text-slate-950">Report Inappropriate Post</h3>
              </div>
              <button
                type="button"
                onClick={() => setReportingPostId(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="py-6 text-center text-xs font-bold text-emerald-600">
                ✓ Report submitted. Platform moderators will review this item.
              </div>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Help keep our editing studio constructive and safe. What is wrong with this post?
                  </p>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-orange-400"
                  >
                    <option value="Spam or off-topic advertising">Spam or off-topic advertising</option>
                    <option value="Harassment or inappropriate language">Harassment or inappropriate language</option>
                    <option value="Copyright violation or unauthorized media">Copyright violation or unauthorized media</option>
                    <option value="Other concern">Other concern</option>
                  </select>
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <Button variant="secondary" size="sm" onClick={() => setReportingPostId(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 text-white"
                    size="sm"
                    onClick={handleSendReport}
                  >
                    Submit Report
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
