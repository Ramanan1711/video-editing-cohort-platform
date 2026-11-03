import { useCallback, useEffect, useRef, useState } from 'react';

export interface ScreenProtectionOptions {
  enabled?: boolean;
  userEmail?: string | null;
  userId?: string | null;
  userName?: string | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onRestricted?: (reason: string) => void;
  onRestored?: () => void;
}

export interface ScreenProtectionState {
  isRestricted: boolean;
  restrictionReason: string | null;
  watermarkText: string;
  watermarkPosition: { x: number; y: number };
  clearRestriction: () => void;
  triggerManualRestriction: (reason: string) => void;
  isProtectionActive: boolean;
  toggleProtection: () => void;
}

export function useScreenProtection({
  enabled = true,
  userEmail,
  userId,
  userName,
  videoRef,
  onRestricted,
  onRestored,
}: ScreenProtectionOptions = {}): ScreenProtectionState {
  const [isProtectionActive, setIsProtectionActive] = useState<boolean>(enabled);
  const [isRestricted, setIsRestricted] = useState<boolean>(false);
  const [restrictionReason, setRestrictionReason] = useState<string | null>(null);

  // Dynamic floating watermark position (coordinates in percentage)
  const [watermarkPosition, setWatermarkPosition] = useState<{ x: number; y: number }>({
    x: 20,
    y: 25,
  });

  const positionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Format watermark string
  const watermarkText = [
    userName || 'Iunoware Student',
    userEmail || (userId ? `ID: ${userId.slice(0, 8)}` : 'Verified Learner'),
    'Protected Content · Iunoware Academy',
  ].filter(Boolean).join(' · ');

  // Shift watermark to random coordinates every 12 seconds
  useEffect(() => {
    if (!isProtectionActive) return;

    const shiftPosition = () => {
      // Keep watermark safely within the visible 16:9 frame (10% to 75% range)
      const newX = Math.floor(10 + Math.random() * 65);
      const newY = Math.floor(15 + Math.random() * 60);
      setWatermarkPosition({ x: newX, y: newY });
    };

    positionTimerRef.current = setInterval(shiftPosition, 12000);
    return () => {
      if (positionTimerRef.current) clearInterval(positionTimerRef.current);
    };
  }, [isProtectionActive]);

  // Restrict playback immediately
  const triggerRestriction = useCallback(
    (reason: string) => {
      if (!isProtectionActive) return;

      // Pause playback immediately if playing
      if (videoRef?.current && !videoRef.current.paused) {
        try {
          videoRef.current.pause();
        } catch {
          // ignore playback interruption error
        }
      }

      setIsRestricted(true);
      setRestrictionReason(reason);
      onRestricted?.(reason);
    },
    [isProtectionActive, videoRef, onRestricted]
  );

  // Clear restriction and allow student to resume
  const clearRestriction = useCallback(() => {
    setIsRestricted(false);
    setRestrictionReason(null);
    onRestored?.();
  }, [onRestored]);

  // Manual trigger for testing or administrative enforcement
  const triggerManualRestriction = useCallback(
    (reason: string) => {
      triggerRestriction(reason);
    },
    [triggerRestriction]
  );

  const toggleProtection = useCallback(() => {
    setIsProtectionActive((prev) => {
      if (prev) {
        setIsRestricted(false);
        setRestrictionReason(null);
      }
      return !prev;
    });
  }, []);

  // Listen for screen capture / recording hotkeys
  useEffect(() => {
    if (!isProtectionActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      // 1. Windows PrintScreen
      if (key === 'PrintScreen') {
        e.preventDefault();
        triggerRestriction('Screen capture hotkey (PrintScreen) detected');
        // Clear clipboard
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText('Protected Content · Iunoware Academy').catch(() => {});
        }
        return;
      }

      // 2. macOS Screen Capture / Screen Recording Shortcuts (Cmd + Shift + 3 / 4 / 5)
      // or Windows Snipping Tool (Win/Ctrl + Shift + S)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (key === '3' || key === '4' || key === '5') {
          e.preventDefault();
          triggerRestriction('macOS screen recording / capture shortcut (Cmd+Shift+3/4/5) detected');
          return;
        }
        if (key.toLowerCase() === 's') {
          e.preventDefault();
          triggerRestriction('Screen snipping tool (Cmd/Win+Shift+S) detected');
          return;
        }
      }

      // 3. Windows Game Bar Screen Recording (Win + Alt + R)
      if (e.altKey && (key.toLowerCase() === 'r' || key === 'PrintScreen')) {
        e.preventDefault();
        triggerRestriction('Screen recording shortcut (Alt+R / Alt+PrtScn) detected');
        return;
      }

      // 4. Print / PDF Export Shortcut (Cmd/Ctrl + P)
      if ((e.metaKey || e.ctrlKey) && key.toLowerCase() === 'p') {
        e.preventDefault();
        triggerRestriction('Page print / PDF export shortcut detected');
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        triggerRestriction('Screen capture hotkey (PrintScreen) detected');
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [isProtectionActive, triggerRestriction]);

  // Hook getDisplayMedia to intercept WebRTC screen sharing attempts
  useEffect(() => {
    if (!isProtectionActive) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return;

    const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

    navigator.mediaDevices.getDisplayMedia = async function (...args) {
      triggerRestriction('Screen sharing or display capture session initiated in browser');
      return originalGetDisplayMedia(...args);
    };

    return () => {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }
    };
  }, [isProtectionActive, triggerRestriction]);

  // Detect visibility changes (e.g. background capture software taking over or tab switching)
  useEffect(() => {
    if (!isProtectionActive) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // If video was playing, pause it to prevent unattended capture
        if (videoRef?.current && !videoRef.current.paused) {
          triggerRestriction('Window lost focus while video playback was active');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isProtectionActive, videoRef, triggerRestriction]);

  return {
    isRestricted,
    restrictionReason,
    watermarkText,
    watermarkPosition,
    clearRestriction,
    triggerManualRestriction,
    isProtectionActive,
    toggleProtection,
  };
}
