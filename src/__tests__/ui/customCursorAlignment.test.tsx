import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { CustomCursor } from '../../components/home/CustomCursor';
import { soundFx } from '../../lib/soundFx';

describe('4.3 Custom Cursor Top-Left Alignment & Pointer Calibration', () => {
  let rafCallbacks: Map<number, (time: number) => void> = new Map();
  let rafIdCounter = 0;

  beforeEach(() => {
    rafCallbacks = new Map();
    rafIdCounter = 0;

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      const id = ++rafIdCounter;
      rafCallbacks.set(id, cb as (time: number) => void);
      return id;
    });

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      rafCallbacks.delete(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const flushRaf = (time = performance.now()) => {
    const callbacksToRun = Array.from(rafCallbacks.entries());
    rafCallbacks.clear();
    for (const [, cb] of callbacksToRun) {
      cb(time);
    }
  };

  it('appends translate(-50%, -50%) to center reticle on pointer coordinates', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('fine'), // Desktop pointer
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<CustomCursor />);

    // Trigger mouse move to (200, 300)
    act(() => {
      fireEvent.mouseMove(window, { clientX: 200, clientY: 300 });
    });

    // Run multiple RAF ticks to let lerp settle near target
    act(() => {
      for (let i = 0; i < 20; i++) {
        flushRaf(i * 16);
      }
    });

    const cursorElement = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(cursorElement).not.toBeNull();

    // Verify inline transform contains both translate3d and translate(-50%, -50%)
    const transform = cursorElement.style.transform;
    expect(transform).toContain('translate3d');
    expect(transform).toContain('translate(-50%, -50%)');
  });

  it('renders custom cursor text when hovering elements with data-cursor', () => {
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

    const { container } = render(
      <div>
        <CustomCursor />
        <button data-cursor="EXPLORE">Button</button>
      </div>
    );

    const button = container.querySelector('button')!;

    act(() => {
      fireEvent.mouseMove(button, { clientX: 150, clientY: 250 });
      flushRaf(100);
    });

    expect(container.textContent).toContain('EXPLORE');
  });

  it('triggers soundFx.playBlip when hovering over interactive elements', () => {
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

    const playBlipSpy = vi.spyOn(soundFx, 'playBlip');

    const { container } = render(
      <div>
        <CustomCursor />
        <button type="button">Click Me</button>
      </div>
    );

    const button = container.querySelector('button')!;

    act(() => {
      fireEvent.mouseMove(button, { clientX: 100, clientY: 100 });
      flushRaf(100);
    });

    expect(playBlipSpy).toHaveBeenCalled();
  });

  it('remains disabled on touch devices or when prefers-reduced-motion is active', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('reduce') || query.includes('coarse'), // touch / reduced motion
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<CustomCursor />);

    // Should return null and not mount any cursor DOM
    expect(container.firstChild).toBeNull();
  });
});

