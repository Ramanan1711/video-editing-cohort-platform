import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HomeIntroVideo } from '../../components/home/HomeIntroVideo';

describe('HomeIntroVideo Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock HTMLMediaElement play & pause in JSDOM
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('renders pure full-screen intro video with target URL and no overlays', async () => {
    const handleComplete = vi.fn();
    await act(async () => {
      render(<HomeIntroVideo onComplete={handleComplete} />);
    });

    // Intro video element check
    const video = document.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('https://iunoware.com/videos/intro.mp4');

    // Confirms no overlay buttons (e.g. SKIP button removed)
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('invokes onComplete when Escape key is pressed', () => {
    vi.useFakeTimers();
    const handleComplete = vi.fn();
    render(<HomeIntroVideo onComplete={handleComplete} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(handleComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('invokes onComplete when video ends', () => {
    vi.useFakeTimers();
    const handleComplete = vi.fn();
    render(<HomeIntroVideo onComplete={handleComplete} />);

    const video = document.querySelector('video')!;
    fireEvent.ended(video);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(handleComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('invokes onComplete when playback reaches near the end without waiting for ended event', () => {
    vi.useFakeTimers();
    const handleComplete = vi.fn();
    render(<HomeIntroVideo onComplete={handleComplete} />);

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 6.0, writable: true });
    Object.defineProperty(video, 'currentTime', { value: 5.85, writable: true });

    fireEvent.timeUpdate(video);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(handleComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('recovers and completes if playback is stalled or buffering for more than 3.5 seconds', () => {
    vi.useFakeTimers();
    const handleComplete = vi.fn();
    render(<HomeIntroVideo onComplete={handleComplete} />);

    const video = document.querySelector('video')!;
    fireEvent.waiting(video);

    // Advance past stall timeout (3500ms) + exit fade transition (600ms)
    act(() => {
      vi.advanceTimersByTime(4200);
    });

    expect(handleComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('guarantees completion via fallback maximum lifetime timeout even if playback completely hangs', () => {
    vi.useFakeTimers();
    const handleComplete = vi.fn();
    render(<HomeIntroVideo onComplete={handleComplete} />);

    // Advance past hard fallback ceiling (9000ms) + exit transition (600ms)
    act(() => {
      vi.advanceTimersByTime(9700);
    });

    expect(handleComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('allows clicking/tapping to dismiss the intro video if user wants to skip', () => {
    vi.useFakeTimers();
    const handleComplete = vi.fn();
    render(<HomeIntroVideo onComplete={handleComplete} />);

    const container = screen.getByRole('dialog');
    // First click un-mutes
    fireEvent.click(container);
    // Second click skips immediately
    fireEvent.click(container);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(handleComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
