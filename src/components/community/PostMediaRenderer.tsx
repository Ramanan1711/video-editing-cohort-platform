import React, { useState } from 'react';
import {
  Download,
  FileCode,
  FileArchive,
  FileText,
  Film,
  Maximize2,
  X,
} from 'lucide-react';

interface PostMediaRendererProps {
  mediaUrl?: string | null;
  mediaType?: 'video' | 'image' | 'file' | null;
  fileName?: string | null;
  className?: string;
}

export const PostMediaRenderer: React.FC<PostMediaRendererProps> = ({
  mediaUrl,
  mediaType,
  fileName,
  className = '',
}) => {
  const [imageModalOpen, setImageModalOpen] = useState(false);

  if (!mediaUrl) return null;

  // Extract YouTube ID if applicable
  const getYouTubeId = (url: string): string | null => {
    const match = url.match(
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
    );
    return match ? match[1] : null;
  };

  // Extract Vimeo ID if applicable
  const getVimeoId = (url: string): string | null => {
    const match = url.match(/(?:vimeo\.com\/)(\d+)/);
    return match ? match[1] : null;
  };

  const youtubeId = getYouTubeId(mediaUrl);
  const vimeoId = getVimeoId(mediaUrl);

  // 1. YouTube Video Embed
  if (youtubeId) {
    return (
      <div className={`overflow-hidden rounded-2xl bg-black shadow-md ${className}`}>
        <div className="relative aspect-video w-full">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`}
            title={fileName || 'YouTube video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        </div>
      </div>
    );
  }

  // 2. Vimeo Video Embed
  if (vimeoId) {
    return (
      <div className={`overflow-hidden rounded-2xl bg-black shadow-md ${className}`}>
        <div className="relative aspect-video w-full">
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0`}
            title={fileName || 'Vimeo video'}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        </div>
      </div>
    );
  }

  // 3. Direct HTML5 Video Player
  if (
    mediaType === 'video' ||
    mediaUrl.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i)
  ) {
    return (
      <div className={`overflow-hidden rounded-2xl bg-black shadow-md ${className}`}>
        <video
          src={mediaUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full max-h-[460px] object-contain bg-black"
        >
          Your browser does not support HTML5 video playback.
        </video>
      </div>
    );
  }

  // 4. Photo / Image Attachment with Lightbox Zoom
  if (
    mediaType === 'image' ||
    mediaUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i)
  ) {
    return (
      <>
        <div
          onClick={() => setImageModalOpen(true)}
          className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950 cursor-pointer shadow-sm ${className}`}
        >
          <img
            src={mediaUrl}
            alt={fileName || 'Post image attachment'}
            loading="lazy"
            className="w-full max-h-[460px] object-cover transition-transform duration-300 group-hover:scale-[1.01]"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition rounded-full bg-slate-900/80 px-3 py-1 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg">
              <Maximize2 size={13} /> Click to expand
            </span>
          </div>
        </div>

        {/* Fullscreen Lightbox Modal */}
        {imageModalOpen && (
          <div
            onClick={() => setImageModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in"
          >
            <button
              onClick={() => setImageModalOpen(false)}
              className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition"
            >
              <X size={20} />
            </button>
            <img
              src={mediaUrl}
              alt={fileName || 'Fullscreen preview'}
              className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            />
          </div>
        )}
      </>
    );
  }

  // 5. Project File / Resource Attachment Card (Premiere, DaVinci, ZIP, PDF)
  const isZip = fileName?.match(/\.(zip|rar|7z|tar)$/i) || mediaUrl.match(/\.(zip|rar|7z|tar)$/i);
  const isVideoProject =
    fileName?.match(/\.(prproj|drp|aep|fcpbundle)$/i) || mediaUrl.match(/\.(prproj|drp|aep|fcpbundle)$/i);
  const isDoc = fileName?.match(/\.(pdf|docx|txt)$/i) || mediaUrl.match(/\.(pdf|docx|txt)$/i);

  return (
    <div
      className={`flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60 ${className}`}
    >
      <div className="flex items-center gap-3 truncate">
        <div className="flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 shrink-0">
          {isVideoProject ? (
            <Film size={20} />
          ) : isZip ? (
            <FileArchive size={20} />
          ) : isDoc ? (
            <FileText size={20} />
          ) : (
            <FileCode size={20} />
          )}
        </div>

        <div className="truncate">
          <p className="text-xs font-black text-slate-950 dark:text-white truncate">
            {fileName || 'Starter Project / Asset Attachment'}
          </p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            {isVideoProject
              ? 'NLE Timeline Project'
              : isZip
              ? 'ZIP Asset Archive'
              : isDoc
              ? 'Document'
              : 'Resource Link'}
          </p>
        </div>
      </div>

      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        download={fileName || true}
        className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-slate-800 shadow-xs border border-slate-200 hover:bg-orange-50 hover:text-orange-600 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:hover:bg-orange-950/40 shrink-0 transition"
      >
        <Download size={14} />
        <span>Download</span>
      </a>
    </div>
  );
};
