import React from 'react';
import {
  Clock3,
  Gauge,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { Lesson, parseVideoUrl } from '../../../lib/courseService';

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
  setShowResumePrompt: (show: boolean) => void;
  isRefreshingStream: boolean;
  streamError: string | null;
  refreshSignedUrl: (resumeAt?: number, autoResume?: boolean) => Promise<void>;
  watchPercentage: number;
  effectiveCompleted: boolean;
  playbackSpeed: number;
  handleSpeedChange: (speed: number) => void;
  handleTimeUpdate: () => void;
  handleEnded: () => void;
  handleVideoError: () => void;
  handlePlay: () => void;
  handlePause: () => void;
  handlePlaying: () => void;
  lastKnownTimeRef: React.MutableRefObject<number>;
  refreshAttemptsRef: React.MutableRefObject<number>;
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
  setShowResumePrompt,
  isRefreshingStream,
  streamError,
  refreshSignedUrl,
  watchPercentage,
  effectiveCompleted,
  playbackSpeed,
  handleSpeedChange,
  handleTimeUpdate,
  handleEnded,
  handleVideoError,
  handlePlay,
  handlePause,
  handlePlaying,
  lastKnownTimeRef,
  refreshAttemptsRef,
}: VideoScreenProps) {
  return (
    <>
      {/* Video Container Area with 16:9 Aspect Ratio */}
      <div
        ref={videoContainerRef}
        tabIndex={0}
        aria-label="Video player viewport. Press Space to play or pause, F for fullscreen, Left and Right arrows to seek."
        className="group relative aspect-video w-full overflow-hidden bg-black focus:outline-hidden focus:ring-2 focus:ring-orange-500"
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
                onClick={() => setShowResumePrompt(false)}
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
            className="absolute inset-0 size-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : videoMeta.type === 'video' ? (
          <>
            <video
              ref={videoRef}
              key={lesson.id}
              className="absolute inset-0 size-full object-contain bg-black"
              controls
              src={videoMeta.directUrl!}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onError={handleVideoError}
              onPlay={handlePlay}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-orange-950/40 p-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10 text-orange-400 backdrop-blur-md shadow-2xl mb-3">
              <Play size={28} fill="currentColor" className="ml-1" />
            </div>
            <h4 className="text-sm font-bold text-white">Video Lesson Stream</h4>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              Source timeline or lesson video is being finalized by instructor.
            </p>
          </div>
        )}

        {/* Video Overlays */}
        <div className="pointer-events-none absolute top-4 left-4">
          <span className="rounded-md bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
            Lesson {lesson.position}
          </span>
        </div>

        {lesson.duration_minutes && (
          <div className="pointer-events-none absolute top-4 right-4">
            <span className="rounded-md bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {lesson.duration_minutes} mins
            </span>
          </div>
        )}
      </div>

      {/* Video Watch Progress & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-2.5 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Clock3 size={13} className="text-orange-500" />
            Watch Progress:
          </span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-28 sm:w-44 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  watchPercentage >= 80 || effectiveCompleted ? 'bg-emerald-500' : 'bg-orange-500'
                }`}
                style={{ width: `${Math.max(watchPercentage, effectiveCompleted ? 100 : 0)}%` }}
              />
            </div>
            <span className="font-mono font-bold text-slate-700">
              {Math.max(watchPercentage, effectiveCompleted ? 100 : 0)}%
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {watchPercentage >= 80 || effectiveCompleted ? (
              <span className="font-bold text-emerald-600">✓ Completed (≥80% watched)</span>
            ) : (
              <span>(80% required to verify)</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Keyboard shortcut guide badge */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700 font-bold">Space</span> Play
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700 font-bold">F</span> Fullscreen
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
        </div>
      </div>
    </>
  );
}

