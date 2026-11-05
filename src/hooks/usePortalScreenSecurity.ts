import { useEffect } from 'react';
import { useToast } from '../context/useToast';
import { isCertificateModalActive } from '../lib/certificateProtectionHelper';

export const CAPTURE_DETECTED_STORAGE_KEY = 'iunoware_capture_detected';
export const SECURITY_ALERT_EVENT = 'iunoware:security-alert';

export function usePortalScreenSecurity() {
  const toast = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Suppress screen capture triggers while CertificateModal is active
      if (isCertificateModalActive()) return;

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
        // Narrow detector strictly to capture keys only: 3, 4, 5, 6, S
        // Allow legitimate browser/navigation shortcuts like Cmd+Shift+T (reopen closed tab),
        // Cmd+Shift+R (hard reload), Cmd+Shift+Z (redo), etc.
        const isCapture =
          key === '3' ||
          key === '#' ||
          e.code === 'Digit3' ||
          key === '4' ||
          key === '$' ||
          e.code === 'Digit4' ||
          key === '5' ||
          key === '%' ||
          e.code === 'Digit5' ||
          key === '6' ||
          key === '^' ||
          e.code === 'Digit6' ||
          key.toLowerCase() === 's' ||
          e.code === 'KeyS';

        if (!isCapture) {
          return;
        }

        e.preventDefault();
        const reason = 'Screen recording / capture shortcut (Cmd/Ctrl+Shift+3/4/5/S) detected on portal';
        sessionStorage.setItem(CAPTURE_DETECTED_STORAGE_KEY, reason);
        window.dispatchEvent(new CustomEvent(SECURITY_ALERT_EVENT, { detail: { reason } }));
        toast?.error('Content Protection: Screen recording shortcuts are disabled.');
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText('Protected Content · Iunoware Academy').catch(() => {});
        }
        return;
      }

      // 3. Windows Game Bar Screen Recording (Win + Alt + R / Alt + PrtScn)
      if (e.altKey && !e.metaKey && !e.ctrlKey && (key.toLowerCase() === 'r' || key === 'PrintScreen')) {
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
        if (isCertificateModalActive()) {
          return originalGetDisplayMedia!(...args);
        }
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

