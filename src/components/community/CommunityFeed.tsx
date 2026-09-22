import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { LeaderboardCard } from './LeaderboardCard';
import { useAuth } from '../../context/useAuth';
import {
  listCohortPosts,
  type CommunityPost,
} from '../../lib/communityService';

interface CommunityFeedProps {
  onOpenCreateModal: () => void;
  selectedChannelId?: string;
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  selectedChannelId,
}) => {
  const { profile } = useAuth();
  const [filterType, setFilterType] = useState<'all' | 'pinned' | 'qa' | 'squad'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Pinned post state
  const [pinnedExpanded, setPinnedExpanded] = useState(false);
  const [pinnedLikes, setPinnedLikes] = useState(18);
  const [isPinnedLiked, setIsPinnedLiked] = useState(false);
  const [pinnedCommentsCount, setPinnedCommentsCount] = useState(7);
  const [showPinnedComments, setShowPinnedComments] = useState(false);
  const [pinnedComments, setPinnedComments] = useState<
    { id: string; name: string; role: string; text: string; time: string }[]
  >([
    {
      id: 'c-1',
      name: 'Thilak',
      role: 'Student',
      text: 'Congrats Shibin! That sound design on the intro hook was mind blowing 🤯',
      time: '18h ago',
    },
    {
      id: 'c-2',
      name: 'Meshak',
      role: 'Student',
      text: 'Honored to be in top 3! Pushing for #1 on Week 3 music video challenge.',
      time: '14h ago',
    },
    {
      id: 'c-3',
      name: 'Shibin (Lead Mentor)',
      role: 'Mentor',
      text: 'Incredible work from the entire Batch 15. The grading bar was extremely high this week.',
      time: '10h ago',
    },
  ]);
  const [newCommentText, setNewCommentText] = useState('');
  const [shareToast, setShareToast] = useState(false);

  // Dynamic user posts from database
  const [userPosts, setUserPosts] = useState<CommunityPost[]>([]);

  useEffect(() => {
    let active = true;
    listCohortPosts()
      .then((data) => {
        if (active) {
          setUserPosts(data.filter((p) => !p.is_pinned));
        }
      })
      .catch(() => {
        // graceful
      });

    return () => {
      active = false;
    };
  }, [selectedChannelId]);

  const handlePinnedLike = () => {
    if (isPinnedLiked) {
      setPinnedLikes((l) => l - 1);
      setIsPinnedLiked(false);
    } else {
      setPinnedLikes((l) => l + 1);
      setIsPinnedLiked(true);
    }
  };

  const handleAddPinnedComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment = {
      id: `comm-${Date.now()}`,
      name: profile?.full_name || 'Community Editor',
      role: profile?.role === 'admin' ? 'Admin' : profile?.role === 'mentor' ? 'Mentor' : 'Student',
      text: newCommentText.trim(),
      time: 'Just now',
    };

    setPinnedComments((prev) => [newComment, ...prev]);
    setPinnedCommentsCount((c) => c + 1);
    setNewCommentText('');
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(window.location.href);
    }
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {shareToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles size={14} className="text-orange-400" />
          <span>Post link copied to clipboard!</span>
        </div>
      )}

      {/* Top Controls: Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            Community Feed
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Latest announcements, student projects, leaderboards &amp; discussions.
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            <SlidersHorizontal size={14} />
            <span className="capitalize">{filterType === 'all' ? 'Filters' : filterType}</span>
          </button>

          {showFilterDropdown && (
            <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-30">
              {(['all', 'pinned', 'qa', 'squad'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setFilterType(type);
                    setShowFilterDropdown(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition ${
                    filterType === type
                      ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="capitalize">{type === 'all' ? 'All Posts' : type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MAIN PINNED POST: Pro Editors Club Leaderboard (Matching Screenshot) */}
      {(filterType === 'all' || filterType === 'pinned') && (
        <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md transition-shadow dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5 sm:p-6 space-y-4">
            {/* Pinned Tag & Author Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  <Pin size={12} className="fill-amber-600" />
                  <span>Pinned</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-950 to-slate-900 text-white font-black text-xs shadow-xs">
                    PRO
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-950 dark:text-white">
                        Pro Editors Club
                      </span>
                      <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black tracking-wide uppercase text-white">
                        CREATOR
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      1d • B15 - Full Stack Video Editing Cohort (Growth+)
                    </p>
                  </div>
                </div>
              </div>

              <button
                title="Post options"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition"
              >
                <MoreHorizontal size={17} />
              </button>
            </div>

            {/* Post Title & Description */}
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-slate-950 dark:text-white">
                🏆 B15 - W2 - Top 3 Projects 🏆 ...
              </h2>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Congratulations to our top creators this week! The pacing, storytelling, and sound design
                demonstrated exceptional craft across the timeline challenge.
                {pinnedExpanded ? (
                  <>
                    {' '}
                    Shibin took first place with flawless kinetic text and audio dynamics. Thilak followed closely
                    with high-retention commercial rhythm, and Meshak brought unmatched cinematic color grade mood.
                    Keep raising the standard!
                  </>
                ) : null}
              </p>

              <button
                onClick={() => setPinnedExpanded(!pinnedExpanded)}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400"
              >
                {pinnedExpanded ? 'See less' : 'See more'}
              </button>
            </div>

            {/* Rich Graphic Leaderboard Card */}
            <LeaderboardCard />

            {/* Post Interaction Bar (Likes, Comments, Views, Share) */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-6">
                {/* Likes */}
                <button
                  onClick={handlePinnedLike}
                  className={`flex items-center gap-1.5 transition ${
                    isPinnedLiked
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Heart
                    size={16}
                    className={isPinnedLiked ? 'fill-rose-500 text-rose-500' : ''}
                  />
                  <span>{pinnedLikes}</span>
                </button>

                {/* Comments */}
                <button
                  onClick={() => setShowPinnedComments(!showPinnedComments)}
                  className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition"
                >
                  <MessageSquare size={16} />
                  <span>{pinnedCommentsCount}</span>
                </button>

                {/* Views */}
                <div className="flex items-center gap-1.5">
                  <Eye size={16} />
                  <span>254</span>
                </div>
              </div>

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
              >
                <Share2 size={15} />
                <span>Share</span>
              </button>
            </div>

            {/* Interactive Comment Thread Drawer */}
            {showPinnedComments && (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50 space-y-3">
                <form onSubmit={handleAddPinnedComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Write a supportive comment or critique..."
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-orange-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="flex items-center justify-center rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-black text-white hover:bg-orange-600 transition"
                  >
                    <Send size={13} />
                  </button>
                </form>

                <div className="space-y-2.5 pt-2">
                  {pinnedComments.map((comm) => (
                    <div
                      key={comm.id}
                      className="rounded-xl bg-white p-3 border border-slate-100 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {comm.name}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {comm.role}
                          </span>
                        </div>
                        <span className="text-slate-400">{comm.time}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {comm.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      )}

      {/* Dynamic Community Discussion Posts */}
      {userPosts.map((post) => (
        <article
          key={post.id}
          className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow dark:border-slate-800 dark:bg-slate-900 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-orange-100 text-orange-800 font-black text-xs dark:bg-orange-950/40 dark:text-orange-300">
                {post.author_name?.slice(0, 2).toUpperCase() || 'ST'}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {post.author_name || 'Community Member'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {new Date(post.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {post.title && (
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {post.title}
            </h3>
          )}

          <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {post.body}
          </p>
        </article>
      ))}
    </div>
  );
};
