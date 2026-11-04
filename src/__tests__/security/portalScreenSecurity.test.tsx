import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePortalScreenSecurity, CAPTURE_DETECTED_STORAGE_KEY, SECURITY_ALERT_EVENT } from '../../hooks/usePortalScreenSecurity';

const mockToastError = vi.fn();

vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    error: mockToastError,
    info: vi.fn(),
    success: vi.fn(),
  }),
}));

describe('usePortalScreenSecurity - Shortcut Detector Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('allows navigation shortcuts (Cmd+Shift+T and Cmd+Shift+R) without triggering security error toast', () => {
    renderHook(() => usePortalScreenSecurity());

    const alertListener = vi.fn();
    window.addEventListener(SECURITY_ALERT_EVENT, alertListener);

    // 1. Simulate Cmd+Shift+T (Reopen closed tab)
    const eventT = new KeyboardEvent('keydown', {
      key: 't',
      code: 'KeyT',
      metaKey: true,
      shiftKey: true,
      cancelable: true,
      bubbles: true,
    });
    const defaultPreventedT = !window.dispatchEvent(eventT);

    expect(defaultPreventedT).toBe(false);
    expect(mockToastError).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(CAPTURE_DETECTED_STORAGE_KEY)).toBeNull();
    expect(alertListener).not.toHaveBeenCalled();

    // 2. Simulate Cmd+Shift+R (Hard reload)
    const eventR = new KeyboardEvent('keydown', {
      key: 'r',
      code: 'KeyR',
      metaKey: true,
      shiftKey: true,
      cancelable: true,
      bubbles: true,
    });
    const defaultPreventedR = !window.dispatchEvent(eventR);

    expect(defaultPreventedR).toBe(false);
    expect(mockToastError).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(CAPTURE_DETECTED_STORAGE_KEY)).toBeNull();
    expect(alertListener).not.toHaveBeenCalled();

    window.removeEventListener(SECURITY_ALERT_EVENT, alertListener);
  });

  it('allows other common modifier shortcuts like Cmd+Shift+Z without triggering security error toast', () => {
    renderHook(() => usePortalScreenSecurity());

    const eventZ = new KeyboardEvent('keydown', {
      key: 'z',
      code: 'KeyZ',
      metaKey: true,
      shiftKey: true,
      cancelable: true,
      bubbles: true,
    });
    window.dispatchEvent(eventZ);

    expect(mockToastError).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(CAPTURE_DETECTED_STORAGE_KEY)).toBeNull();
  });

  it('detects and restricts macOS screen capture shortcut (Cmd+Shift+3)', () => {
    renderHook(() => usePortalScreenSecurity());

    const alertListener = vi.fn();
    window.addEventListener(SECURITY_ALERT_EVENT, alertListener);

    const event3 = new KeyboardEvent('keydown', {
      key: '3',
      code: 'Digit3',
      metaKey: true,
      shiftKey: true,
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      window.dispatchEvent(event3);
    });

    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringMatching(/screen recording shortcuts are disabled/i)
    );
    expect(sessionStorage.getItem(CAPTURE_DETECTED_STORAGE_KEY)).toContain('Cmd/Ctrl+Shift+3/4/5/S');
    expect(alertListener).toHaveBeenCalledTimes(1);

    window.removeEventListener(SECURITY_ALERT_EVENT, alertListener);
  });

  it('detects and restricts macOS screen capture shortcut (Cmd+Shift+4)', () => {
    renderHook(() => usePortalScreenSecurity());

    const event4 = new KeyboardEvent('keydown', {
      key: '4',
      code: 'Digit4',
      metaKey: true,
      shiftKey: true,
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      window.dispatchEvent(event4);
    });

    expect(mockToastError).toHaveBeenCalled();
    expect(sessionStorage.getItem(CAPTURE_DETECTED_STORAGE_KEY)).toContain('Cmd/Ctrl+Shift+3/4/5/S');
  });

  it('detects and restricts macOS screen capture shortcut (Cmd+Shift+5)', () => {
    renderHook(() => usePortalScreenSecurity());

    const event5 = new KeyboardEvent('keydown', {
      key: '5',
      code: 'Digit5',
      metaKey: true,
      shiftKey: true,
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      window.dispatchEvent(event5);
    });

    expect(mockToastError).toHaveBeenCalled();
    expect(sessionStorage.getItem(CAPTURE_DETECTED_STORAGE_KEY)).toContain('Cmd/Ctrl+Shift+3/4/5/S');
  });

  it('detects and restricts Windows Snipping Tool shortcut (Ctrl+Shift+S / Cmd+Shift+S)', () => {
    renderHook(() => usePortalScreenSecurity());

    const eventS = new KeyboardEvent('keydown', {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      shiftKey: true,
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      window.dispatchEvent(eventS);
    });

    expect(mockToastError).toHaveBeenCalled();
    expect(sessionStorage.getItem(CAPTURE_DETECTED_STORAGE_KEY)).toContain('Cmd/Ctrl+Shift+3/4/5/S');
  });

  it('detects and restricts PrintScreen hotkey', () => {
    renderHook(() => usePortalScreenSecurity());

    const eventPrintScreen = new KeyboardEvent('keydown', {
      key: 'PrintScreen',
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      window.dispatchEvent(eventPrintScreen);
    });

    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringMatching(/screen capture is disabled/i)
    );
    expect(sessionStorage.getItem(CAPTURE_DETECTED_STORAGE_KEY)).toContain('PrintScreen');
  });
});

