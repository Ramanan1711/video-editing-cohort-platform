import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LessonPlayer } from '../../pages/StudentDashboard';
import * as courseService from '../../lib/courseService';
import type { Lesson } from '../../lib/courseService';

vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../../lib/courseService', async () => {
  const actual = await vi.importActual<typeof courseService>('../../lib/courseService');
  return {
    ...actual,
    listLessonResources: vi.fn().mockResolvedValue([]),
    getLessonResourceDownloadUrl: vi.fn().mockResolvedValue('https://signed.download/file.zip'),
    getSecureAssetUrl: vi.fn(),
    updateLessonWatchProgress: vi.fn().mockResolvedValue(undefined),
  };
});

describe('LessonPlayer - Expired Signed URL Recovery and Stream Continuity', () => {
  const mockLesson: Lesson = {
    id: 'lesson-101',
    module_id: 'module-1',
    title: 'Advanced Multi-Cam Editing Techniques',
    description: 'Practical multi-cam editing walkthrough and pacing tips',
    position: 1,
    video_url: 'https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=initial_token_123',
    duration_minutes: 25,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes secure playback by resolving a signed asset URL for course-assets', async () => {
    const getSecureAssetUrlSpy = vi.mocked(courseService.getSecureAssetUrl).mockResolvedValueOnce(
      'https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=signed_token_abc'
    );

    let renderedContainer: HTMLElement | undefined;
    await act(async () => {
      const { container } = render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
          userId="student-123"
        />
      );
      renderedContainer = container;
    });

    expect(getSecureAssetUrlSpy).toHaveBeenCalledWith(mockLesson.video_url);

    const videoEl = renderedContainer?.querySelector('video');
    expect(videoEl).toBeInTheDocument();
    expect(videoEl?.getAttribute('src')).toBe(
      'https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=signed_token_abc'
    );
  });

  it('catches video error and automatically invokes getSecureAssetUrl to recover without page reload', async () => {
    const getSecureAssetUrlSpy = vi.mocked(courseService.getSecureAssetUrl)
      .mockResolvedValueOnce('https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=signed_token_abc')
      .mockResolvedValueOnce('https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=fresh_recovered_token_789');

    // Mock fetch for Range chunk probe returning 403 Forbidden
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 403,
      ok: false,
    } as unknown as Response);

    let renderedContainer: HTMLElement | undefined;
    await act(async () => {
      const { container } = render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
          userId="student-123"
          initialLastPositionSeconds={140}
        />
      );
      renderedContainer = container;
    });

    const videoEl = renderedContainer?.querySelector('video') as HTMLVideoElement;
    expect(videoEl).toBeInTheDocument();

    // Fast-forward simulated clock by 65 minutes (> 1 hour expiration)
    vi.setSystemTime(Date.now() + 65 * 60 * 1000);

    // Simulate playback error (chunk 403 / expired token)
    await act(async () => {
      fireEvent.error(videoEl);
    });

    await waitFor(() => {
      // Expect second call to getSecureAssetUrl with lesson video url
      expect(getSecureAssetUrlSpy).toHaveBeenCalledTimes(2);
    });

    expect(videoEl.getAttribute('src')).toBe(
      'https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=fresh_recovered_token_789'
    );

    fetchSpy.mockRestore();
  });

  it('proactively renews expired signed URL when unpausing video after long pause (> 50 minutes)', async () => {
    const getSecureAssetUrlSpy = vi.mocked(courseService.getSecureAssetUrl)
      .mockResolvedValueOnce('https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=initial_signed')
      .mockResolvedValueOnce('https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=proactively_renewed');

    let renderedContainer: HTMLElement | undefined;
    await act(async () => {
      const { container } = render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
          userId="student-123"
        />
      );
      renderedContainer = container;
    });

    const videoEl = renderedContainer?.querySelector('video') as HTMLVideoElement;
    expect(videoEl).toBeInTheDocument();

    // Advance clock by 55 minutes (> 50 min threshold)
    vi.setSystemTime(Date.now() + 55 * 60 * 1000);

    // Intern resumes playback (clicks play / unpauses)
    await act(async () => {
      fireEvent.play(videoEl);
    });

    await waitFor(() => {
      expect(getSecureAssetUrlSpy).toHaveBeenCalledTimes(2);
    });

    expect(videoEl.getAttribute('src')).toBe(
      'https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=proactively_renewed'
    );
  });

  it('renders a reconnection fallback overlay when automatic retries are exhausted and allows manual stream reconnect', async () => {
    // Return failed promises on renewal to trigger retry exhaustion
    vi.mocked(courseService.getSecureAssetUrl)
      .mockResolvedValueOnce('https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=initial')
      .mockRejectedValue(new Error('Network offline or 403 Forbidden'));

    let renderedContainer: HTMLElement | undefined;
    await act(async () => {
      const { container } = render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
          userId="student-123"
        />
      );
      renderedContainer = container;
    });

    const videoEl = renderedContainer?.querySelector('video') as HTMLVideoElement;

    // Trigger errors to exhaust retry threshold (>= 3 attempts)
    await act(async () => {
      fireEvent.error(videoEl);
    });
    await act(async () => {
      fireEvent.error(videoEl);
    });
    await act(async () => {
      fireEvent.error(videoEl);
    });
    await act(async () => {
      fireEvent.error(videoEl);
    });

    // Reconnection UI overlay should now be visible
    expect(await screen.findByTestId('video-stream-error-overlay')).toBeInTheDocument();
    expect(screen.getByText(/Playback Interrupted/i)).toBeInTheDocument();

    const reconnectBtn = screen.getByRole('button', { name: /reconnect video stream/i });
    expect(reconnectBtn).toBeInTheDocument();

    // Next click succeeds
    vi.mocked(courseService.getSecureAssetUrl).mockResolvedValueOnce(
      'https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=manual_reconnected_url'
    );

    await act(async () => {
      fireEvent.click(reconnectBtn);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('video-stream-error-overlay')).not.toBeInTheDocument();
    });

    expect(videoEl.getAttribute('src')).toBe(
      'https://xyz.supabase.co/storage/v1/object/sign/course-assets/lessons/multicam.mp4?token=manual_reconnected_url'
    );
  });
});
