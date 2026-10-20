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

  it('renders intro video with correct target URL and controls', async () => {
    const handleComplete = vi.fn();
    await act(async () => {
      render(<HomeIntroVideo onComplete={handleComplete} />);
    });

    // Intro video element check
    const video = document.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('https://iunoware.com/videos/intro.mp4');

    // Controls present
    expect(screen.getByRole('button', { name: /Skip Intro/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unmute Audio|Mute Audio/i })).toBeInTheDocument();
  });

  it('invokes onComplete when user clicks Skip Intro', () => {
    vi.useFakeTimers();
    const handleComplete = vi.fn();
    render(<HomeIntroVideo onComplete={handleComplete} />);

    const skipButton = screen.getByRole('button', { name: /Skip Intro/i });
    fireEvent.click(skipButton);

    // Fast-forward exit transition timeout
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(handleComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
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
