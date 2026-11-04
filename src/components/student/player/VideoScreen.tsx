import React, { useEffect, useState, useCallback } from 'react';
import {
  Clock3,
  Gauge,
  Maximize,
  Minimize,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { Lesson, parseVideoUrl } from '../../../lib/courseService';
import { useScreenProtection } from '../../../hooks/useScreenProtection';
import { ScreenProtectionOverlay } from './ScreenProtectionOverlay';

export interface VideoScreenProps {
  lesson: Lesson;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  videoMeta: ReturnType<typeof parseVideoUrl>;
  hudMessage: {
    text: string;
    icon: 'play' | 'pause' | 'rewind' | 'forward' | 'fullscreen';
  } | null;
  showResumePrompt: boolean;
  initialLastPositionSeconds: number;
  handleResumePlayback: () => void;
  handleStartOver?: () => void;
  setShowResumePrompt: (show: boolean) => void;
  isRefreshingStream: boolean;
  streamError: string | null;
  refreshSignedUrl: (resumeAt?: number, autoResume?: boolean) => Promise<void>;
  watchPercentage: number;
  effectiveCompleted: boolean;
  playbackSpeed: number;
  handleSpeedChange: (speed: number) => void;
  handleTimeUpdate: () => void;
  handleLoadedMetadata?: () => void;
  handleEnded: () => void;
  handleVideoError: () => void;
  handlePlay: () => void;
  handlePause: () => void;
  handlePlaying: () => void;
  lastKnownTimeRef: React.MutableRefObject<number>;
  refreshAttemptsRef: React.MutableRefObject<number>;
  resolvedThumbnailUrl?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  userName?: string | null;
  enableScreenProtection?: boolean;
}

interface WebkitFullscreenDocument extends Document {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
}

export function VideoScreen({
  lesson,
  videoRef,
  videoContainerRef,
  videoMeta,
  hudMessage,
  showResumePrompt,
  initialLastPositionSeconds,
  handleResumePlayback,
  handleStartOver,
  setShowResumePrompt,
  isRefreshingStream,
  streamError,
  refreshSignedUrl,
  watchPercentage,
  effectiveCompleted,
  playbackSpeed,
  handleSpeedChange,
  handleTimeUpdate,
  handleLoadedMetadata,
  handleEnded,
  handleVideoError,
  handlePlay,
  handlePause,
  handlePlaying,
  lastKnownTimeRef,
  refreshAttemptsRef,
  resolvedThumbnailUrl,
  userEmail,
  userId,
  userName,
  enableScreenProtection,
}: VideoScreenProps) {
  const screenProtection = useScreenProtection({
    enabled: enableScreenProtection ?? true,
    userEmail,
    userId,
    userName,
    videoRef,
    onRestored: () => {
      if (videoRef.current && videoRef.current.paused) {
        try {
          const playPromise = videoRef.current.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
          }
        } catch {
          // ignore playback interruption
        }
      }
    },
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (typeof document === 'undefined') return;
      const fsElement = document.fullscreenElement || (document as WebkitFullscreenDocument).webkitFullscreenElement;
      setIsFullscreen(!!fsElement && (fsElement === videoContainerRef.current || fsElement === videoRef.current));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [videoRef, videoContainerRef]);

  // Synchronously direct any fullscreen request on the video element to the container
  // so that watermarks, security shields, and HUDs are preserved during fullscreen mode.
  useEffect(() => {
    const vid = videoRef.current;
    const container = videoContainerRef.current;
    if (!vid || !container) return;

    const origRequestFullscreen = vid.requestFullscreen;
    const vidWebkit = vid as unknown as WebkitFullscreenElement;
    const containerWebkit = container as unknown as WebkitFullscreenElement;
    const origWebkitRequestFullscreen = vidWebkit.webkitRequestFullscreen;

    vid.requestFullscreen = function (options?: FullscreenOptions) {
      if (container.requestFullscreen) {
        return container.requestFullscreen(options);
      }
      return origRequestFullscreen ? origRequestFullscreen.call(vid, options) : Promise.resolve();
    };

    if (origWebkitRequestFullscreen || containerWebkit.webkitRequestFullscreen) {
      vidWebkit.webkitRequestFullscreen = function () {
        if (containerWebkit.webkitRequestFullscreen) {
          return containerWebkit.webkitRequestFullscreen();
        }
        if (container.requestFullscreen) {
          return container.requestFullscreen();
        }
        return origWebkitRequestFullscreen ? origWebkitRequestFullscreen.call(vid) : undefined;
      };
    }

    return () => {
      if (origRequestFullscreen) {
        vid.requestFullscreen = origRequestFullscreen;
      }
      if (origWebkitRequestFullscreen) {
        vidWebkit.webkitRequestFullscreen = origWebkitRequestFullscreen;
      }
    };
  }, [videoRef, videoContainerRef]);

  const toggleFullscreen = useCallback(() => {
    const container = videoContainerRef.current || videoRef.current;
    if (!container || typeof document === 'undefined') return;

    const docWebkit = document as WebkitFullscreenDocument;
    const containerWebkit = container as unknown as WebkitFullscreenElement;
    const fsElement = document.fullscreenElement || docWebkit.webkitFullscreenElement;
    if (!fsElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if (containerWebkit.webkitRequestFullscreen) {
        containerWebkit.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (docWebkit.webkitExitFullscreen) {
        docWebkit.webkitExitFullscreen();
      }
    }
  }, [videoContainerRef, videoRef]);

  return (
    <>
      {/* Video Container Area with 16:9 Aspect Ratio and Fullscreen support */}
      <div
        ref={videoContainerRef}
        tabIndex={0}
        onContextMenu={(e) => e.preventDefault()}
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement;
          if (target && target.tagName !== 'BUTTON' && target.tagName !== 'INPUT' && target.tagName !== 'A') {
            toggleFullscreen();
          }
        }}
        aria-label="Video player viewport. Press Space to play or pause, F for fullscreen, Left and Right arrows to seek."
        className="group relative aspect-video w-full overflow-hidden bg-black focus:outline-hidden focus:ring-2 focus:ring-orange-500 [&:fullscreen]:aspect-auto [&:fullscreen]:size-full [&:-webkit-full-screen]:aspect-auto [&:-webkit-full-screen]:size-full"
      >

        {/* HUD Feedback Toast Overlay */}
        {hudMessage && (
          <div
            data-testid="video-hud-overlay"
            className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center gap-2.5 bg-black/40 backdrop-blur-xs text-white animate-in fade-in zoom-in-95 duration-100"
          >
            {hudMessage.icon === 'play' && <Play size={20} fill="currentColor" className="text-orange-400" />}
            {hudMessage.icon === 'pause' && (
              <div className="flex gap-1">
                <div className="w-1.5 h-4 bg-orange-400 rounded-xs" />
                <div className="w-1.5 h-4 bg-orange-400 rounded-xs" />
              </div>
            )}
            {hudMessage.icon === 'rewind' && <RotateCcw size={18} className="text-orange-400" />}
            {hudMessage.icon === 'forward' && <Sparkles size={18} className="text-orange-400" />}
            {hudMessage.icon === 'fullscreen' && <Gauge size={18} className="text-orange-400" />}
            <span className="text-xs font-mono font-bold tracking-wider uppercase">{hudMessage.text}</span>
          </div>
        )}

        {/* Floating Resume Playback Prompt */}
        {showResumePrompt && initialLastPositionSeconds > 0 && (
          <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900/90 p-3.5 text-white backdrop-blur-md border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-xs">
                <Play size={13} fill="currentColor" />
              </span>
              <div>
                <p className="text-xs font-bold">
                  Resume playback from {Math.floor(initialLastPositionSeconds / 60)}:
                  {String(Math.floor(initialLastPositionSeconds % 60)).padStart(2, '0')}?
                </p>
                <p className="text-[10px] text-slate-300">
                  Pick up where you left off during your last editing session.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResumePlayback}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition shadow-2xs"
              >
                Resume ({Math.floor(initialLastPositionSeconds / 60)}:{String(Math.floor(initialLastPositionSeconds % 60)).padStart(2, '0')})
              </button>
              <button
                type="button"
                onClick={handleStartOver || (() => setShowResumePrompt(false))}
                className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition"
              >
                Start Over
              </button>
            </div>
          </div>
        )}

        {videoMeta.type === 'embed' ? (
          <iframe
            src={videoMeta.embedUrl!}
            title={lesson.title}
            className={`absolute inset-0 size-full border-0 ${
              screenProtection.isRestricted ? 'opacity-0 invisible pointer-events-none' : 'opacity-100 visible'
            }`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : videoMeta.type === 'video' ? (
          <>
            <video
              ref={videoRef}
              key={lesson.id}
              className={`absolute inset-0 size-full object-contain bg-black select-none ${
                screenProtection.isRestricted ? 'opacity-0 invisible pointer-events-none' : 'opacity-100 visible'
              }`}
              controls={!screenProtection.isRestricted}
              controlsList="nodownload"
              disablePictureInPicture={true}
              onContextMenu={(e) => e.preventDefault()}
              poster={resolvedThumbnailUrl || undefined}
              src={videoMeta.directUrl!}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onError={handleVideoError}
              onPlay={(e) => {
                if (screenProtection.isRestricted) {
                  try {
                    e.currentTarget.pause();
                  } catch {
                    // ignore
                  }
                  return;
                }
                handlePlay();
              }}
              onPause={handlePause}
              onPlaying={handlePlaying}
            />

            {/* In-place Re-authenticating / Refreshing Overlay */}
            {isRefreshingStream && !streamError && (
              <div
                data-testid="video-reauthenticating-overlay"
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs text-white"
              >
                <RefreshCw size={28} className="animate-spin text-orange-400 mb-2" />
                <p className="text-xs font-semibold text-slate-200">Re-authenticating secure stream...</p>
                <p className="text-[11px] text-slate-400">
                  Restoring playback from your last position...
                </p>
              </div>
            )}

            {/* Stream Error / Reconnect Fallback UI */}
            {streamError && (
              <div
                data-testid="video-stream-error-overlay"
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center backdrop-blur-sm"
              >
                <div className="flex size-14 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-400 mb-3">
                  <RefreshCw size={24} className={isRefreshingStream ? 'animate-spin' : ''} />
                </div>
                <h4 className="text-base font-bold text-white">Playback Interrupted</h4>
                <p className="mt-1 text-xs text-slate-300 max-w-sm mb-4">
                  {streamError}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    refreshAttemptsRef.current = 0;
                    void refreshSignedUrl(lastKnownTimeRef.current, true);
                  }}
                  disabled={isRefreshingStream}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition shadow-lg disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isRefreshingStream ? 'animate-spin' : ''} />
                  {isRefreshingStream ? 'Renewing Access...' : 'Reconnect Video Stream'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-orange-950/40 p-6 text-center relative overflow-hidden">
            {resolvedThumbnailUrl && (
              <img
                src={resolvedThumbnailUrl}
                alt={lesson.title}
                className="absolute inset-0 size-full object-cover opacity-25 blur-xs"
              />
            )}
            <div className="relative z-10 flex flex-col items-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10 text-orange-400 backdrop-blur-md shadow-2xl mb-3">
                <Play size={28} fill="currentColor" className="ml-1" />
              </div>
              <h4 className="text-sm font-bold text-white">Video Lesson Stream</h4>
              <p className="mt-1 text-xs text-slate-400 max-w-sm">
                Source timeline or lesson video is being finalized by instructor.
              </p>
            </div>
          </div>
        )}

        {/* Video Overlays */}
        <div className="pointer-events-none absolute top-4 left-4">
          <span className="rounded-md bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
            Lesson {lesson.position}
          </span>
        </div>

        {lesson.duration_minutes && !isFullscreen && (
          <div className="pointer-events-none absolute top-4 right-4">
            <span className="rounded-md bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {lesson.duration_minutes} mins
            </span>
          </div>
        )}

        {/* Floating Quick Exit Fullscreen button on overlay */}
        {isFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Exit Fullscreen"
            title="Exit Fullscreen (Esc or F)"
            className="absolute top-4 right-4 z-40 flex items-center gap-1.5 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md border border-white/20 shadow-xl hover:bg-black transition cursor-pointer"
          >
            <Minimize size={13} className="text-orange-400" />
            <span>Exit Fullscreen</span>
          </button>
        )}

        {/* Anti-Screen Recording & DRM Protection Shield & Forensic Watermark (Rendered on top of video) */}
        <ScreenProtectionOverlay
          isRestricted={screenProtection.isRestricted}
          restrictionReason={screenProtection.restrictionReason}
          watermarkText={screenProtection.watermarkText}
          watermarkPosition={screenProtection.watermarkPosition}
          onDismissRestriction={screenProtection.clearRestriction}
          showWatermark={screenProtection.isProtectionActive}
        />
      </div>

      {/* Video Watch Progress & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-surface-elevated/40 px-6 py-2.5 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Clock3 size={13} className="text-orange-500" />
            Watch Progress:
          </span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-28 sm:w-44 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  watchPercentage >= 80 || effectiveCompleted ? 'bg-emerald-500' : 'bg-orange-500'
                }`}
                style={{ width: `${Math.max(watchPercentage, effectiveCompleted ? 100 : 0)}%` }}
              />
            </div>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
              {Math.max(watchPercentage, effectiveCompleted ? 100 : 0)}%
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            {watchPercentage >= 80 || effectiveCompleted ? (
              <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ Completed (≥80% watched)</span>
            ) : (
              <span>(80% required to verify)</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* DRM / Anti-Capture Status Indicator */}
          <div
            data-testid="screen-protection-status-badge"
            className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"
          >
            <ShieldCheck size={11} className="text-emerald-500" />
            <span className="hidden sm:inline">Anti-Capture Protected</span>
            <span className="sm:hidden">Protected</span>
          </div>

          {/* Keyboard shortcut guide badge */}
          <div className="hidden xl:flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            <span className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-slate-700 dark:text-slate-200 font-bold">Space</span> Play
            <span className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-slate-700 dark:text-slate-200 font-bold">F</span> Fullscreen
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700 font-bold">←/→</span> ±5s
          </div>

          {videoMeta.type === 'video' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 font-bold text-slate-600">
                <Gauge size={13} className="text-orange-500" />
                <span>Speed:</span>
              </div>
              <div className="flex items-center gap-1">
                {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`rounded-md px-2 py-0.5 font-bold transition text-[11px] ${
                      playbackSpeed === speed
                        ? 'bg-orange-500 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            title={isFullscreen ? 'Exit Fullscreen (Esc or F)' : 'Fullscreen (F)'}
            data-testid="player-fullscreen-toggle"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-elevated px-2.5 py-1 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition font-bold shadow-2xs cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize size={13} className="text-orange-500" />
            ) : (
              <Maximize size={13} className="text-orange-500" />
            )}
            <span className="text-[11px] font-mono">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>
    </>
  );
}

