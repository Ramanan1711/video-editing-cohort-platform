import { useEffect } from 'react';
import { useToast } from '../context/useToast';

export const CAPTURE_DETECTED_STORAGE_KEY = 'iunoware_capture_detected';
export const SECURITY_ALERT_EVENT = 'iunoware:security-alert';

export function usePortalScreenSecurity() {
  const toast = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      // 1. Windows PrintScreen
      if (key === 'PrintScreen') {
        e.preventDefault();
        const reason = 'Screen capture hotkey (PrintScreen) detected on portal';
        sessionStorage.setItem(CAPTURE_DETECTED_STORAGE_KEY, reason);
        window.dispatchEvent(new CustomEvent(SECURITY_ALERT_EVENT, { detail: { reason } }));
        toast?.error('Content Protection: Screen capture is disabled on Iunoware Academy.');
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText('Protected Content · Iunoware Academy').catch(() => {});
        }
        return;
      }

      // 2. macOS Screen Capture / Screen Recording Shortcuts (Cmd + Shift + 3/4/5/6)
      // or Windows Snipping Tool (Win/Ctrl + Shift + S)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        // Allow text editing shortcuts like Cmd+Shift+Z (Redo) or text selection inside inputs
        const target = e.target as HTMLElement | null;
        const isTextInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (isTextInput && (key.toLowerCase() === 'z' || key.startsWith('Arrow'))) {
          return;
        }

        e.preventDefault();
        const reason = 'macOS screen recording / capture shortcut (Cmd+Shift+3/4/5) detected on portal';
        sessionStorage.setItem(CAPTURE_DETECTED_STORAGE_KEY, reason);
        window.dispatchEvent(new CustomEvent(SECURITY_ALERT_EVENT, { detail: { reason } }));
        toast?.error('Content Protection: Screen recording shortcuts (Cmd+Shift) are disabled.');
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText('Protected Content · Iunoware Academy').catch(() => {});
        }
        return;
      }

      // 3. Windows Game Bar Screen Recording (Win + Alt + R / Alt + PrtScn)
      if (e.altKey && (key.toLowerCase() === 'r' || key === 'PrintScreen')) {
        e.preventDefault();
        const reason = 'Screen recording shortcut (Alt+R / Alt+PrtScn) detected on portal';
        sessionStorage.setItem(CAPTURE_DETECTED_STORAGE_KEY, reason);
        window.dispatchEvent(new CustomEvent(SECURITY_ALERT_EVENT, { detail: { reason } }));
        toast?.error('Content Protection: Screen recording shortcuts are disabled.');
        return;
      }

      // 4. Developer Tools Inspection (F12, Cmd+Opt+I/J/C)
      if (
        key === 'F12' ||
        ((e.metaKey || e.ctrlKey) && e.altKey && (key.toLowerCase() === 'i' || key.toLowerCase() === 'j' || key.toLowerCase() === 'c')) ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (key.toLowerCase() === 'i' || key.toLowerCase() === 'j' || key.toLowerCase() === 'c'))
      ) {
        e.preventDefault();
        const reason = 'Developer tools inspection hotkey detected on portal';
        sessionStorage.setItem(CAPTURE_DETECTED_STORAGE_KEY, reason);
        window.dispatchEvent(new CustomEvent(SECURITY_ALERT_EVENT, { detail: { reason } }));
        return;
      }
    };

    // Hook getDisplayMedia portal-wide to prevent browser screen sharing
    let originalGetDisplayMedia: typeof navigator.mediaDevices.getDisplayMedia | null = null;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
      originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia = async function (...args) {
        const reason = 'Screen sharing or display capture session initiated in browser';
        sessionStorage.setItem(CAPTURE_DETECTED_STORAGE_KEY, reason);
        window.dispatchEvent(new CustomEvent(SECURITY_ALERT_EVENT, { detail: { reason } }));
        toast?.error('Content Protection: Screen sharing is disabled on Iunoware Academy.');
        return originalGetDisplayMedia!(...args);
      };
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (originalGetDisplayMedia && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }
    };
  }, [toast]);
}

