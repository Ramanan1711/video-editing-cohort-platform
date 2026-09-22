import React, { useState } from 'react';
import { X, Sparkles, Pin, Send } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { createCommunityPost } from '../../lib/communityService';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const { profile, user } = useAuth();
  const [channel, setChannel] = useState('feed');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAdminOrMentor = profile?.role === 'admin' || profile?.role === 'mentor';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await createCommunityPost(
        user?.id || '',
        body.trim(),
        null,
        null,
        title.trim() || null,
        isPinned
      );

      setTitle('');
      setBody('');
      setIsPinned(false);
      onPostCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
              <Sparkles size={16} />
            </span>
            <h3 className="text-sm font-black text-slate-950 dark:text-white">
              Create Community Post
            </h3>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs font-bold text-red-600">
            {error}
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Channel Selector */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Destination Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-orange-500 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            >
              <option value="feed">📡 General Feed (Cohort Broadcast)</option>
              <option value="qa">⁉️ Q&amp;A (Editing &amp; Software Help)</option>
              <option value="community">🔥 Batch 15 Community</option>
              <option value="squad">🔷 B15 Blue Squad</option>
            </select>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Headline / Topic
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 2 Pacing Question or Top Cut Showcase"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-orange-500 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Body Input */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Post Content
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share insights, ask questions, or link your project timeline..."
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-orange-500 dark:border-slate-800 dark:bg-slate-800 dark:text-white resize-none"
            />
          </div>

          {/* Admin / Creator Pinned Toggle */}
          {isAdminOrMentor && (
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="size-4 rounded text-orange-500 focus:ring-orange-500"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Pin size={13} className="text-amber-500" />
                Pin to top of feed (Staff feature)
              </span>
            </label>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !body.trim()}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2 text-xs font-black text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 disabled:opacity-50 transition"
            >
              <Send size={13} />
              <span>{submitting ? 'Publishing...' : 'Publish Post'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
