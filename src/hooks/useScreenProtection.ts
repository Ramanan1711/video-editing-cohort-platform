import { useCallback, useEffect, useRef, useState } from 'react';

export interface ScreenProtectionOptions {
  enabled?: boolean;
  userEmail?: string | null;
  userId?: string | null;
  userName?: string | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onRestricted?: (reason: string) => void;
  onRestored?: () => void;
  protectOnBlur?: boolean;
  pauseOnBlur?: boolean;
  onBlurPause?: () => void;
}

export interface ScreenProtectionState {
  isRestricted: boolean;
  restrictionReason: string | null;
  watermarkText: string;
  studentIdentifier: string;
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
  protectOnBlur = true,
  pauseOnBlur,
  onBlurPause,
}: ScreenProtectionOptions = {}): ScreenProtectionState {
  const shouldPauseOnBlur = pauseOnBlur ?? protectOnBlur ?? true;
  const [isProtectionActive, setIsProtectionActive] = useState<boolean>(enabled);
  const [isRestricted, setIsRestricted] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem('iunoware_capture_detected');
      // Clean up legacy focus lost lockouts so users returning to the app are not stuck
      if (
        stored === 'Screen capture or window focus lost' ||
        stored === 'Window lost focus while video playback was active'
      ) {
        window.sessionStorage.removeItem('iunoware_capture_detected');
        return false;
      }
      return !!stored;
    }
    return false;
  });
  const [restrictionReason, setRestrictionReason] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem('iunoware_capture_detected');
      if (
        stored === 'Screen capture or window focus lost' ||
        stored === 'Window lost focus while video playback was active'
      ) {
        window.sessionStorage.removeItem('iunoware_capture_detected');
        return null;
      }
      return stored || null;
    }
    return null;
  });

  // Dynamic floating watermark position (coordinates in percentage)
  const [watermarkPosition, setWatermarkPosition] = useState<{ x: number; y: number }>({
    x: 25,
    y: 30,
  });

  const positionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Primary student identifier
  const studentIdentifier = userEmail || (userId ? `ID: ${userId.slice(0, 8)}` : 'Verified Learner');

  // Format watermark string
  const watermarkText = [
    userName || 'Iunoware Student',
    studentIdentifier,
    'Protected Content · Iunoware Academy',
  ].filter(Boolean).join(' · ');

  // Shift floating watermark to random coordinates every 8 seconds
  useEffect(() => {
    if (!isProtectionActive) return;

    const shiftPosition = () => {
      // Keep watermark safely within the visible 16:9 frame (12% to 70% range)
      const newX = Math.floor(12 + Math.random() * 58);
      const newY = Math.floor(18 + Math.random() * 52);
      setWatermarkPosition({ x: newX, y: newY });
    };

    positionTimerRef.current = setInterval(shiftPosition, 8000);
    return () => {
      if (positionTimerRef.current) clearInterval(positionTimerRef.current);
    };
  }, [isProtectionActive]);

  // Restrict playback immediately
  const triggerRestriction = useCallback(
    (reason: string) => {
      if (!isProtectionActive) return;

      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('iunoware_capture_detected', reason);
      }

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
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem('iunoware_capture_detected');
    }
    setIsRestricted(false);
    setRestrictionReason(null);
    onRestored?.();
  }, [onRestored]);

  // Listen for portal-level security events triggered on other pages (e.g. dashboard)
  useEffect(() => {
    if (!isProtectionActive) return;

    const handleSecurityAlert = (e: Event) => {
      const customEvent = e as CustomEvent<{ reason?: string }>;
      const reason = customEvent.detail?.reason || 'Screen capture or recording tool detected';
      triggerRestriction(reason);
    };

    window.addEventListener('iunoware:security-alert', handleSecurityAlert);
    return () => {
      window.removeEventListener('iunoware:security-alert', handleSecurityAlert);
    };
  }, [isProtectionActive, triggerRestriction]);

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

  // 1. Hotkey & Keyboard Interception
  useEffect(() => {
    if (!isProtectionActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      // Windows PrintScreen
      if (key === 'PrintScreen') {
        e.preventDefault();
        triggerRestriction('Screen capture hotkey (PrintScreen) detected');
        // Scramble clipboard
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText('Protected Content · Iunoware Academy').catch(() => {});
        }
        return;
      }

      // macOS Screen Capture / Screen Recording Shortcuts (Cmd + Shift + 3 / 4 / 5 / 6)
      // or Windows Snipping Tool (Win/Ctrl + Shift + S)
      // CRITICAL MACOS M-SERIES / SILICON FIX:
      // The macOS WindowServer intercepts the digit keys (3, 4, 5) BEFORE the browser DOM
      // receives keydown. Therefore, detecting the combination of (metaKey || ctrlKey) + shiftKey
      // MUST trigger immediately before the OS screen grab takes place!
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        // If user is editing text in an input and using Cmd+Shift+Z (Redo) or text navigation, allow it
        const target = e.target as HTMLElement | null;
        const isTextInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (isTextInput && (key.toLowerCase() === 'z' || key.startsWith('Arrow'))) {
          return;
        }

        e.preventDefault();
        triggerRestriction('macOS screen recording / capture shortcut (Cmd+Shift+3/4/5) detected');
        // Scramble clipboard in case Cmd+Ctrl+Shift was used to copy screenshot
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText('Protected Content · Iunoware Academy').catch(() => {});
        }
        return;
      }

      // Windows Game Bar Screen Recording (Win + Alt + R / Alt + PrtScn)
      if (e.altKey && (key.toLowerCase() === 'r' || key === 'PrintScreen')) {
        e.preventDefault();
        triggerRestriction('Screen recording shortcut (Alt+R / Alt+PrtScn) detected');
        return;
      }

      // DevTools Inspection (F12, Cmd+Opt+I, Ctrl+Shift+I, Cmd+Opt+J, Cmd+Opt+C)
      if (
        key === 'F12' ||
        ((e.metaKey || e.ctrlKey) && e.altKey && (key.toLowerCase() === 'i' || key.toLowerCase() === 'j' || key.toLowerCase() === 'c')) ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (key.toLowerCase() === 'i' || key.toLowerCase() === 'j' || key.toLowerCase() === 'c'))
      ) {
        e.preventDefault();
        triggerRestriction('Developer tools inspection hotkey detected');
        return;
      }

      // Page print / PDF export shortcut (Cmd/Ctrl + P)
      if ((e.metaKey || e.ctrlKey) && key.toLowerCase() === 'p') {
        e.preventDefault();
        triggerRestriction('Page print / PDF export shortcut detected');
        return;
      }

      // View Source / Page Save (Cmd/Ctrl + U, Cmd/Ctrl + S)
      if ((e.metaKey || e.ctrlKey) && (key.toLowerCase() === 'u' || key.toLowerCase() === 's')) {
        e.preventDefault();
        triggerRestriction('Page source / save shortcut detected');
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

  // 2. Window Blur & Unfocus Detection
  // (Whenever the student switches to another window - e.g. taking notes in split-screen mode -
  // pause playback to avoid missing lesson content, but DO NOT lock out the student).
  useEffect(() => {
    if (!isProtectionActive || !shouldPauseOnBlur) return;

    const handleWindowBlur = () => {
      // Pause playback immediately if playing, without locking out the student
      if (videoRef?.current && !videoRef.current.paused) {
        try {
          videoRef.current.pause();
        } catch {
          // ignore playback interruption
        }
        onBlurPause?.();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isProtectionActive, shouldPauseOnBlur, videoRef, onBlurPause]);

  // 3. Hook getDisplayMedia to intercept WebRTC screen sharing attempts
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

  // 4. Tab Visibility Detection (Minimizing tab or switching tabs during playback)
  useEffect(() => {
    if (!isProtectionActive || !shouldPauseOnBlur) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (videoRef?.current && !videoRef.current.paused) {
          try {
            videoRef.current.pause();
          } catch {
            // ignore
          }
          onBlurPause?.();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isProtectionActive, shouldPauseOnBlur, videoRef, onBlurPause]);

  return {
    isRestricted,
    restrictionReason,
    watermarkText,
    studentIdentifier,
    watermarkPosition,
    clearRestriction,
    triggerManualRestriction,
    isProtectionActive,
    toggleProtection,
  };
}
