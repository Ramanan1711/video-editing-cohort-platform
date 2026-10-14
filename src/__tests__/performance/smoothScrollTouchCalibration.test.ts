import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSmoothScroll } from '../../lib/scroll/useSmoothScroll';

const lenisMockInstances: unknown[] = [];

vi.mock('lenis', () => {
  class MockLenis {
    options: unknown;
    on = vi.fn();
    raf = vi.fn();
    resize = vi.fn();
    scrollTo = vi.fn();
    destroy = vi.fn();

    constructor(options: unknown) {
      this.options = options;
      lenisMockInstances.push(this);
    }
  }
  return { default: MockLenis };
});

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    ticker: {
      add: vi.fn(),
      remove: vi.fn(),
      lagSmoothing: vi.fn(),
    },
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    update: vi.fn(),
    refresh: vi.fn(),
  },
}));

describe('4.2 Lenis Smooth Scroll Touch Calibration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lenisMockInstances.length = 0;
    delete (window as unknown as { lenis?: unknown }).lenis;
  });

  afterEach(() => {
    lenisMockInstances.length = 0;
    delete (window as unknown as { lenis?: unknown }).lenis;
  });

  it('disables Lenis entirely on pure touch devices (pointer: coarse) to preserve native 120Hz momentum scrolling', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('coarse'), // Coarse pointer (mobile/tablet touchscreen)
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    renderHook(() => useSmoothScroll(true));

    // Lenis should NOT be instantiated on mobile touchscreens
    expect(lenisMockInstances.length).toBe(0);
    expect((window as unknown as { lenis?: unknown }).lenis).toBeUndefined();
  });

  it('initializes Lenis on desktop with syncTouch: false and touchMultiplier: 0', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('fine'), // Fine pointer (desktop mouse/trackpad)
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { unmount } = renderHook(() => useSmoothScroll(true));

    expect(lenisMockInstances.length).toBe(1);
    const instance = lenisMockInstances[0] as { options: unknown };

    // Verified: syncTouch must be false to avoid intercepting touch events
    expect(instance.options).toMatchObject({
      lerp: 0.08,
      wheelMultiplier: 1.05,
      touchMultiplier: 0,
      smoothWheel: true,
      syncTouch: false,
      autoResize: true,
    });

    expect((window as unknown as { lenis?: unknown }).lenis).toBeDefined();

    unmount();
    expect((window as unknown as { lenis?: unknown }).lenis).toBeUndefined();
  });

  it('does nothing when enabled is false', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('fine'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    renderHook(() => useSmoothScroll(false));

    expect(lenisMockInstances.length).toBe(0);
  });
});
