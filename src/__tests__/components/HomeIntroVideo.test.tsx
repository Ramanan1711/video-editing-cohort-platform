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
});
