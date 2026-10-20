import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowRight, Play, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { BRAND_LOGO_URL } from '../../constants/branding';
import { soundFx } from '../../lib/soundFx';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';

const INTRO_VIDEO_URL = 'https://iunoware.com/videos/intro.mp4';

interface HomeIntroVideoProps {
  onComplete: () => void;
}

export const HomeIntroVideo: React.FC<HomeIntroVideoProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [hasAudioAutoplayFailed, setHasAudioAutoplayFailed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  // Lock scrolling while the intro video is active
  useModalScrollLock(!isExiting);

  const handleFinish = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    soundFx.playSweep(280, 640, 0.12, 0.04);
    setTimeout(() => {
      onComplete();
    }, 650);
  }, [isExiting, onComplete]);

  // Attempt video playback on mount with graceful muted fallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Default to unmuted if soundFx is enabled; fallback to muted if browser autoplay blocks it
    const shouldTrySound = soundFx.isEnabled();
    video.muted = !shouldTrySound;
    setIsMuted(!shouldTrySound);

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          // Unmuted autoplay was prevented by browser policy -> fall back to muted autoplay
          video.muted = true;
          setIsMuted(true);
          setHasAudioAutoplayFailed(true);
          video.play().catch(() => {
            // If even muted autoplay fails (e.g. strict low-power mode), finish gracefully
            handleFinish();
          });
        });
    }
  }, [handleFinish]);

  // Keyboard accessibility: ESC skips, Space pauses/resumes, M toggles mute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleFinish();
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
      soundFx.playBlip(540, 0.02, 'sine', 0.02);
    } else {
      video.pause();
      setIsPlaying(false);
      soundFx.playBlip(420, 0.02, 'sine', 0.02);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    setHasAudioAutoplayFailed(false);
    if (!nextMuted && !soundFx.isEnabled()) {
      soundFx.toggle();
    }
    soundFx.playBlip(nextMuted ? 380 : 560, 0.025, 'sine', 0.03);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col justify-between bg-black text-white select-none overflow-hidden transition-all duration-700 ease-out film-grain ${
        isExiting
          ? 'opacity-0 scale-105 filter blur-md pointer-events-none'
          : 'opacity-100 scale-100'
      }`}
      aria-label="Iunoware Platform Intro Video"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Vignette Gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-10" />

      {/* Bottom Vignette Gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/95 via-black/50 to-transparent z-10" />

      {/* Main Video Viewport */}
      <div
        className="relative flex-1 w-full h-full flex items-center justify-center cursor-pointer"
        onClick={togglePlayPause}
      >
        <video
          ref={videoRef}
          src={INTRO_VIDEO_URL}
          playsInline
          autoPlay
          preload="auto"
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setCurrentTime(v.currentTime);
          }}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDuration(v.duration);
          }}
          onEnded={handleFinish}
          onError={() => {
            // Video load error fallback
            handleFinish();
          }}
          className="w-full h-full object-cover sm:object-contain bg-black max-h-screen"
        />

        {/* Center Pause/Play Indicator (Only shows when paused) */}
        {!isPlaying && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div className="flex size-20 items-center justify-center rounded-full border border-orange-500/40 bg-orange-600/80 text-white shadow-2xl shadow-orange-500/50 backdrop-blur-md">
              <Play size={36} fill="currentColor" className="ml-1 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Top Header Bar */}
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-5 sm:px-8 py-5">
        {/* Brand Left */}
        <div className="flex items-center gap-3">
          <img
            src={BRAND_LOGO_URL}
            alt="Iunoware Logo"
            className="h-9 w-auto object-contain drop-shadow-[0_2px_8px_rgba(249,115,22,0.35)]"
          />
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight text-white font-sans leading-tight">
              Iunoware
            </span>
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-orange-400">
                Official Intro
              </span>
            </div>
          </div>
        </div>

        {/* Controls Right */}
        <div className="flex items-center gap-3">
          {/* Sound / Unmute Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            data-cursor={isMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO'}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-mono font-bold tracking-wider transition-all cursor-pointer backdrop-blur-xl ${
              isMuted
                ? 'border-amber-500/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 shadow-lg shadow-amber-500/20 animate-pulse'
                : 'border-white/20 bg-black/60 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {isMuted ? (
              <>
                <VolumeX size={15} className="text-amber-400" />
                <span className="hidden sm:inline">
                  {hasAudioAutoplayFailed ? 'Tap for Sound' : 'Muted'}
                </span>
              </>
            ) : (
              <>
                <Volume2 size={15} className="text-emerald-400" />
                <span className="hidden sm:inline">Sound On</span>
              </>
            )}
          </button>

          {/* Skip Intro Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleFinish();
            }}
            data-cursor="ENTER PLATFORM"
            title="Skip Intro (Esc)"
            aria-label="Skip Intro"
            className="flex items-center gap-2 rounded-full border border-orange-500/50 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 px-4 sm:px-5 py-2 text-xs font-mono font-bold tracking-widest text-white uppercase backdrop-blur-xl hover:scale-105 hover:shadow-lg hover:shadow-orange-500/30 transition-all cursor-pointer group shadow-md shadow-black"
          >
            <span>Skip Intro</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </header>

      {/* Bottom Bar: Telemetry, Playhead, Shortcuts */}
      <footer className="absolute bottom-0 inset-x-0 z-20 flex flex-col gap-2 pb-4 sm:pb-5 px-5 sm:px-8">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <span className="text-slate-200 font-semibold">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <span className="hidden sm:inline text-white/20">•</span>
            <span className="hidden sm:inline text-slate-400 text-[10px] tracking-wider uppercase">
              Production Reel
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[10px] tracking-wider">
            <span className="hidden md:inline text-slate-500">
              [ESC] Skip • [SPACE] Pause • [M] Mute
            </span>
            <span className="inline-flex items-center gap-1 text-orange-400">
              <Sparkles size={11} />
              <span>Full Experience Ahead</span>
            </span>
          </div>
        </div>

        {/* Cinematic Progress Scrubber Bar */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 shadow-[0_0_10px_rgba(249,115,22,0.8)] transition-[width] duration-150 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </footer>
    </div>
  );
};
