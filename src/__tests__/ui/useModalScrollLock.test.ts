import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';

describe('useModalScrollLock', () => {
  let mockStart: ReturnType<typeof vi.fn>;
  let mockStop: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockStart = vi.fn();
    mockStop = vi.fn();
    (window as unknown as { lenis?: { start: () => void; stop: () => void } }).lenis = {
      start: mockStart,
      stop: mockStop,
    };
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
    delete (window as unknown as { lenis?: unknown }).lenis;
  });

  it('locks body overflow and stops Lenis when opened', () => {
    const { unmount } = renderHook(() => useModalScrollLock(true));

    expect(document.body.style.overflow).toBe('hidden');
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockStart).not.toHaveBeenCalled();

    unmount();

    expect(document.body.style.overflow).toBe('');
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('does nothing when isOpen is false', () => {
    const { unmount } = renderHook(() => useModalScrollLock(false));

    expect(document.body.style.overflow).toBe('');
    expect(mockStop).not.toHaveBeenCalled();

    unmount();

    expect(mockStart).not.toHaveBeenCalled();
  });

  it('handles nested/multiple modal locks via reference counting', () => {
    const hook1 = renderHook(() => useModalScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    expect(mockStop).toHaveBeenCalledTimes(1);

    const hook2 = renderHook(() => useModalScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    // Still stopped, not called a redundant second time
    expect(mockStop).toHaveBeenCalledTimes(1);

    // Unmount hook 1 (modal 1 closes, but modal 2 is still open)
    hook1.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    expect(mockStart).not.toHaveBeenCalled();

    // Unmount hook 2 (all modals closed)
    hook2.unmount();
    expect(document.body.style.overflow).toBe('');
    expect(mockStart).toHaveBeenCalledTimes(1);
  });
});

