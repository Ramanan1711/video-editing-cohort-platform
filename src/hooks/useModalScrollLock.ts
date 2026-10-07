import { useEffect } from 'react';

let activeLockCount = 0;
let originalOverflow = '';

/**
 * useModalScrollLock
 * Prevents background scroll-jacking when modals or mobile drawers are open.
 * Stops Lenis wheel tracking (window.lenis?.stop()) and locks document.body.style.overflow = 'hidden'.
 * Restores Lenis (window.lenis?.start()) and body overflow when all active modals close.
 */
export function useModalScrollLock(isOpen = true): void {
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    if (activeLockCount === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      (window as unknown as { lenis?: { stop: () => void } }).lenis?.stop();
    }
    activeLockCount++;

    return () => {
      activeLockCount--;
      if (activeLockCount <= 0) {
        activeLockCount = 0;
        document.body.style.overflow = originalOverflow;
        (window as unknown as { lenis?: { start: () => void } }).lenis?.start();
      }
    };
  }, [isOpen]);
}

