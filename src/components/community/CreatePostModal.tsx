import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Pin,
  Send,
  Image as ImageIcon,
  Video as VideoIcon,
  FileCode,
  Link as LinkIcon,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import {
  createCommunityPost,
  uploadCommunityMedia,
  detectMediaType,
} from '../../lib/communityService';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

type MediaTab = 'none' | 'photo' | 'video' | 'file' | 'link';

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

  // Media Attachment State
  const [mediaTab, setMediaTab] = useState<MediaTab>('none');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaLink, setMediaLink] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAdminOrMentor = profile?.role === 'admin' || profile?.role === 'mentor';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      let finalMediaUrl: string | null = null;
      let finalMediaType: 'video' | 'image' | 'file' | null = null;
      let finalFileName: string | null = null;

      // Handle file upload if present
      if (selectedFile) {
        setUploadingMedia(true);
        const uploaded = await uploadCommunityMedia(selectedFile);
        finalMediaUrl = uploaded.url;
        finalMediaType = uploaded.type;
        finalFileName = uploaded.name;
      } else if (mediaTab === 'link' && mediaLink.trim()) {
        finalMediaUrl = mediaLink.trim();
        finalMediaType = detectMediaType(mediaLink.trim());
        finalFileName = 'External Media';
      }

      await createCommunityPost(
        user?.id || '',
        body.trim(),
        null,
        null,
        title.trim() || null,
        isPinned,
        finalMediaUrl,
        finalMediaType,
        finalFileName
      );

      // Reset form
      setTitle('');
      setBody('');
      setIsPinned(false);
      removeSelectedFile();
      setMediaLink('');
      setMediaTab('none');

      onPostCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setSubmitting(false);
      setUploadingMedia(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
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

          {/* Media Attachments Selector (Video, Photo, Project, Link) */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Attach Media (Video, Photo, Etc.)
              </span>
              {(selectedFile || mediaLink) && (
                <button
                  type="button"
                  onClick={() => {
                    removeSelectedFile();
                    setMediaLink('');
                    setMediaTab('none');
                  }}
                  className="text-[11px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
                >
                  <Trash2 size={12} /> Clear media
                </button>
              )}
            </div>

            {/* Media Type Tabs */}
            <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  setMediaTab('video');
                  removeSelectedFile();
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                  mediaTab === 'video'
                    ? 'bg-white text-orange-600 shadow-2xs font-black dark:bg-slate-800 dark:text-orange-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                <VideoIcon size={14} />
                <span>Video</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMediaTab('photo');
                  removeSelectedFile();
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                  mediaTab === 'photo'
                    ? 'bg-white text-orange-600 shadow-2xs font-black dark:bg-slate-800 dark:text-orange-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                <ImageIcon size={14} />
                <span>Photo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMediaTab('file');
                  removeSelectedFile();
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                  mediaTab === 'file'
                    ? 'bg-white text-orange-600 shadow-2xs font-black dark:bg-slate-800 dark:text-orange-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                <FileCode size={14} />
                <span>Project</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMediaTab('link');
                  removeSelectedFile();
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                  mediaTab === 'link'
                    ? 'bg-white text-orange-600 shadow-2xs font-black dark:bg-slate-800 dark:text-orange-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                <LinkIcon size={14} />
                <span>URL</span>
              </button>
            </div>

            {/* Media Content Inputs */}
            {mediaTab === 'video' && (
              <div className="space-y-2">
                {!selectedFile ? (
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 cursor-pointer hover:border-orange-400 dark:border-slate-700 dark:bg-slate-900 transition">
                    <VideoIcon size={24} className="text-orange-500 mb-1" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Upload Video (.mp4, .mov, .webm)
                    </span>
                    <span className="text-[10px] text-slate-400">Click to browse your workstation</span>
                    <input
                      type="file"
                      accept="video/*,.mp4,.mov,.webm,.m4v"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-slate-200 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-2 truncate">
                      <VideoIcon size={18} className="text-orange-500 shrink-0" />
                      <span className="text-xs font-bold truncate">{selectedFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeSelectedFile}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {mediaTab === 'photo' && (
              <div className="space-y-2">
                {!selectedFile ? (
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 cursor-pointer hover:border-orange-400 dark:border-slate-700 dark:bg-slate-900 transition">
                    <ImageIcon size={24} className="text-orange-500 mb-1" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Upload Photo (.jpg, .png, .webp, .gif)
                    </span>
                    <span className="text-[10px] text-slate-400">Click to select photo or timeline screenshot</span>
                    <input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img
                      src={previewUrl || ''}
                      alt="Preview"
                      className="w-full h-36 object-cover bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={removeSelectedFile}
                      className="absolute top-2 right-2 rounded-full bg-slate-900/80 p-1 text-white hover:bg-red-600 transition"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {mediaTab === 'file' && (
              <div className="space-y-2">
                {!selectedFile ? (
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 cursor-pointer hover:border-orange-400 dark:border-slate-700 dark:bg-slate-900 transition">
                    <FileCode size={24} className="text-orange-500 mb-1" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Upload Project (.prproj, .drp, .aep, .zip, .pdf)
                    </span>
                    <span className="text-[10px] text-slate-400">Share project templates and assets</span>
                    <input
                      type="file"
                      accept=".prproj,.drp,.aep,.zip,.rar,.pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-slate-200 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-2 truncate">
                      <FileCode size={18} className="text-orange-500 shrink-0" />
                      <span className="text-xs font-bold truncate">{selectedFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeSelectedFile}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {mediaTab === 'link' && (
              <div>
                <input
                  type="url"
                  value={mediaLink}
                  onChange={(e) => setMediaLink(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or Vimeo, Loom link"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-orange-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  YouTube, Vimeo, Loom, and direct video/photo URLs embed automatically.
                </p>
              </div>
            )}
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
              {submitting || uploadingMedia ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{uploadingMedia ? 'Uploading media...' : 'Publishing...'}</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Publish Post</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
