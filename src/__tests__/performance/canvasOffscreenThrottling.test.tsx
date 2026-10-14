import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, act } from '@testing-library/react';
import { HeroCanvasSimulator } from '../../components/home/HeroCanvasSimulator';
import { RobotTerminal } from '../../components/home/RobotTerminal';

describe('4.1 WebGL & Canvas Off-Screen Throttling', () => {
  let observedElements: Element[] = [];
  let observerCallbacks: ((entries: IntersectionObserverEntry[]) => void)[] = [];
  let observerOptions: (IntersectionObserverInit | undefined)[] = [];
  let disconnectSpy: Mock<() => void>;
  let rafCallbacks: Map<number, (time: number) => void> = new Map();
  let rafIdCounter = 0;

  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '';
    readonly scrollMargin: string = '';
    readonly thresholds: ReadonlyArray<number>;
    observe = vi.fn((el: Element) => {
      observedElements.push(el);
    });
    unobserve = vi.fn();
    disconnect = () => {
      disconnectSpy();
    };
    takeRecords = () => [];

    constructor(
      callback: (entries: IntersectionObserverEntry[]) => void,
      options?: IntersectionObserverInit
    ) {
      observerCallbacks.push(callback);
      observerOptions.push(options);
      this.thresholds = Array.isArray(options?.threshold)
        ? options.threshold
        : [options?.threshold ?? 0];
    }
  }

  beforeEach(() => {
    observedElements = [];
    observerCallbacks = [];
    observerOptions = [];
    disconnectSpy = vi.fn();
    rafCallbacks = new Map();
    rafIdCounter = 0;

    // Mock requestAnimationFrame and cancelAnimationFrame for synchronous stepped testing
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      const id = ++rafIdCounter;
      rafCallbacks.set(id, cb as (time: number) => void);
      return id;
    });

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      rafCallbacks.delete(id);
    });

    // Mock IntersectionObserver class
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const triggerIntersection = (index: number, isIntersecting: boolean) => {
    const cb = observerCallbacks[index];
    if (cb) {
      act(() => {
        cb([
          {
            isIntersecting,
            target: observedElements[index] || document.createElement('div'),
            intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: Date.now(),
          } as IntersectionObserverEntry,
        ]);
      });
    }
  };

  const flushRaf = (time = performance.now()) => {
    const callbacksToRun = Array.from(rafCallbacks.entries());
    rafCallbacks.clear();
    for (const [, cb] of callbacksToRun) {
      cb(time);
    }
  };

  describe('HeroCanvasSimulator Offscreen Throttling', () => {
    it('initializes IntersectionObserver with threshold 0.05 and observes container', () => {
      const { unmount } = render(<HeroCanvasSimulator />);

      expect(observerOptions.length).toBeGreaterThanOrEqual(1);
      expect(observerOptions[0]).toEqual({ threshold: 0.05 });
      expect(observedElements.length).toBeGreaterThanOrEqual(1);

      unmount();
      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('pauses particle physics and canvas clearing when scrolled out of view, and resumes when visible', () => {
      const clearRectSpy = vi.fn();
      const fillRectSpy = vi.fn();

      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        resetTransform: vi.fn(),
        scale: vi.fn(),
        clearRect: clearRectSpy,
        fillRect: fillRectSpy,
        createRadialGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
      } as unknown as CanvasRenderingContext2D);

      render(<HeroCanvasSimulator />);

      // Flush 1 initial frame when intersecting
      act(() => {
        flushRaf(100);
      });
      const initialClears = clearRectSpy.mock.calls.length;
      expect(initialClears).toBeGreaterThan(0);

      // Trigger offscreen (isIntersecting = false)
      triggerIntersection(0, false);
      clearRectSpy.mockClear();

      // Flush next animation frame while offscreen
      act(() => {
        flushRaf(200);
      });
      // Should NOT have cleared canvas or calculated particle physics
      expect(clearRectSpy).not.toHaveBeenCalled();

      // Trigger re-entry to viewport (isIntersecting = true)
      triggerIntersection(0, true);

      // Flush next frame
      act(() => {
        flushRaf(300);
      });
      // Rendering resumes smoothly
      expect(clearRectSpy).toHaveBeenCalled();
    });
  });

  describe('RobotTerminal Offscreen Throttling', () => {
    it('initializes IntersectionObserver with threshold 0.05 and observes container', () => {
      const { unmount } = render(<RobotTerminal />);

      expect(observerOptions.length).toBeGreaterThanOrEqual(1);
      expect(observerOptions[0]).toEqual({ threshold: 0.05 });
      expect(observedElements.length).toBeGreaterThanOrEqual(1);

      unmount();
      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('pauses telemetry and CSS fallback updates when offscreen and resumes on viewport re-entry', () => {
      vi.useFakeTimers();

      const { container } = render(<RobotTerminal />);

      // In JSDOM without WebGL context, RobotTerminal runs in fallback CSS 3D mode
      // Initial tick
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const initialUptime = container.textContent;

      // Scroll offscreen
      triggerIntersection(0, false);

      // Advance timers by 3 seconds while offscreen
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Uptime should not have ticked while offscreen
      expect(container.textContent).toBe(initialUptime);

      // Scroll back into view
      triggerIntersection(0, true);

      // Advance timer by 1 second while visible
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Uptime should now have updated
      expect(container.textContent).not.toBe(initialUptime);

      vi.useRealTimers();
    });
  });
});
