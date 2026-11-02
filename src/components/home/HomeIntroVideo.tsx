import React, { useEffect, useRef, useState, useCallback } from 'react';
import { soundFx } from '../../lib/soundFx';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';

const INTRO_VIDEO_URL = 'https://iunoware.com/videos/intro.mp4';
const MAX_FALLBACK_TIMEOUT_MS = 9000; // Hard max ceiling in case video completely hangs
const STALL_TIMEOUT_MS = 3500; // Max time to wait if video stalls/buffers mid-playback

interface HomeIntroVideoProps {
  onComplete: () => void;
}

export const HomeIntroVideo: React.FC<HomeIntroVideoProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExiting, setIsExiting] = useState(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxLifetimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnmutedRef = useRef(false);

  // Lock scrolling while the full screen intro is active
  useModalScrollLock(!isExiting);

  const handleFinish = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);

    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    if (maxLifetimeTimerRef.current) {
      clearTimeout(maxLifetimeTimerRef.current);
      maxLifetimeTimerRef.current = null;
    }

    soundFx.playSweep(280, 640, 0.12, 0.04);
    setTimeout(() => {
      onComplete();
    }, 600);
  }, [isExiting, onComplete]);

  // Autoplay video on mount & set fallback ceiling
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Hard fallback timeout: guarantees user is never permanently stuck
    maxLifetimeTimerRef.current = setTimeout(() => {
      handleFinish();
    }, MAX_FALLBACK_TIMEOUT_MS);

    const startPlayback = async () => {
      try {
        video.muted = !soundFx.isEnabled();
        await video.play();
      } catch {
        // Fall back to muted autoplay if browser autoplay policy blocks unmuted audio
        video.muted = true;
        try {
          await video.play();
        } catch {
          handleFinish();
        }
      }
    };

    void startPlayback();

    return () => {
      if (maxLifetimeTimerRef.current) clearTimeout(maxLifetimeTimerRef.current);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, [handleFinish]);

  // Once metadata is loaded, tune safety watchdog to video duration + 1.5s
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video || !video.duration || isNaN(video.duration)) return;

    if (maxLifetimeTimerRef.current) {
      clearTimeout(maxLifetimeTimerRef.current);
    }
    const dynamicTimeout = Math.min((video.duration + 1.5) * 1000, MAX_FALLBACK_TIMEOUT_MS);
    maxLifetimeTimerRef.current = setTimeout(() => {
      handleFinish();
    }, dynamicTimeout);
  };

  // Near-end progress watchdog: handles browsers that fail to fire 'ended'
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.duration && video.currentTime >= video.duration - 0.25) {
      handleFinish();
    }
  };

  // Stalled / Buffering watchdog
  const handleWaitingOrStalled = () => {
    if (!stallTimerRef.current) {
      stallTimerRef.current = setTimeout(() => {
        handleFinish();
      }, STALL_TIMEOUT_MS);
    }
  };

  const handlePlaying = () => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  };

  // If video pauses near the end or unexpectedly freezes, finish
  const handlePause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.duration && video.currentTime >= video.duration - 0.5) {
      handleFinish();
    }
  };

  // Keyboard shortcut: ESC, Enter or Space to skip/control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        handleFinish();
      } else if (e.code === 'Space') {
        e.preventDefault();
        const video = videoRef.current;
        if (video) {
          if (video.paused) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFinish]);

  // Tab visibility change: if user navigates away, auto-exit
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleFinish();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [handleFinish]);

  // Click handler:
  // - First click un-mutes if muted
  // - Any subsequent click, or clicking while paused/stuck, immediately finishes/skips
  const handleClick = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted && !hasUnmutedRef.current) {
      video.muted = false;
      hasUnmutedRef.current = true;
      return;
    }

    // If already unmuted, or clicked again, or if paused/stuck: skip
    handleFinish();
  };

  return (
    <div
      className={`fixed inset-0 z-[10000] w-screen h-screen bg-black flex items-center justify-center overflow-hidden transition-all duration-700 ease-out select-none cursor-pointer ${
        isExiting
          ? 'opacity-0 scale-105 filter blur-md pointer-events-none'
          : 'opacity-100 scale-100'
      }`}
      onClick={handleClick}
      role="dialog"
      aria-label="Platform Intro"
    >
      {/* Pure Full Screen Video */}
      <video
        ref={videoRef}
        src={INTRO_VIDEO_URL}
        playsInline
        webkit-playsinline="true"
        autoPlay
        preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={handleWaitingOrStalled}
        onStalled={handleWaitingOrStalled}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onEnded={handleFinish}
        onError={handleFinish}
        className="w-full h-full object-cover bg-black pointer-events-none"
      />
    </div>
  );
};
