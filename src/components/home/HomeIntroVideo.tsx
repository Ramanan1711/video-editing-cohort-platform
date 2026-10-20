import React, { useEffect, useRef, useState, useCallback } from 'react';
import { soundFx } from '../../lib/soundFx';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';

const INTRO_VIDEO_URL = 'https://iunoware.com/videos/intro.mp4';

interface HomeIntroVideoProps {
  onComplete: () => void;
}

export const HomeIntroVideo: React.FC<HomeIntroVideoProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExiting, setIsExiting] = useState(false);

  // Lock scrolling while the full screen intro is active
  useModalScrollLock(!isExiting);

  const handleFinish = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    soundFx.playSweep(280, 640, 0.12, 0.04);
    setTimeout(() => {
      onComplete();
    }, 600);
  }, [isExiting, onComplete]);

  // Autoplay video on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
  }, [handleFinish]);

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

  // Unmute on first click if browser started it muted
  const handleClick = () => {
    const video = videoRef.current;
    if (video && video.muted) {
      video.muted = false;
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[10000] w-screen h-screen bg-black flex items-center justify-center overflow-hidden transition-all duration-700 ease-out select-none ${
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
        autoPlay
        preload="auto"
        onEnded={handleFinish}
        onError={handleFinish}
        className="w-full h-full object-cover bg-black"
      />

      {/* Minimal translucent Skip button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleFinish();
        }}
        title="Skip Intro"
        aria-label="Skip Intro"
        className="absolute top-6 right-6 z-20 rounded-full border border-white/20 bg-black/40 hover:bg-black/80 px-4 py-1.5 text-xs font-mono font-medium tracking-widest text-white/80 hover:text-white backdrop-blur-md transition-all cursor-pointer opacity-70 hover:opacity-100"
      >
        SKIP
      </button>
    </div>
  );
};
