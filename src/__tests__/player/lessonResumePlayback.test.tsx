import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LessonPlayer } from '../../components/student/player/LessonPlayer';
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
    getSecureAssetUrl: vi.fn().mockImplementation((url: string) => Promise.resolve(url)),
    updateLessonWatchProgress: vi.fn().mockResolvedValue(undefined),
  };
});

describe('LessonPlayer - Video Resume Playback Flow', () => {
  const mockLesson: Lesson = {
    id: 'lesson-resume-test',
    module_id: 'module-1',
    title: '50-Minute Deep Dive Video Editing Masterclass',
    description: 'Full walkthrough of 50 minutes editing project',
    position: 1,
    video_url: 'https://cdn.example.com/videos/masterclass.mp4',
    duration_minutes: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders resume playback prompt when returning with initialLastPositionSeconds (e.g. 5 minutes = 300s)', async () => {
    await act(async () => {
      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
          userId="student-1"
          initialLastPositionSeconds={300} // 5th minute
          initialWatchPercentage={10}
        />
      );
    });

    // Verify resume prompt is visible with 05:00 timestamp
    expect(screen.getByText(/Resume playback from 5:00\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume \(5:00\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Over/i })).toBeInTheDocument();
  });

  it('immediately flushes watch position and percentage when pausing the video', async () => {
    const onWatchProgressUpdate = vi.fn();
    const updateProgressSpy = vi.mocked(courseService.updateLessonWatchProgress);

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
          userId="student-1"
          cohortId="cohort-1"
          onWatchProgressUpdate={onWatchProgressUpdate}
        />
      );
      renderedContainer = container;
    });

    const videoEl = renderedContainer?.querySelector('video') as HTMLVideoElement;
    expect(videoEl).toBeInTheDocument();

    Object.defineProperty(videoEl, 'duration', { value: 3000, writable: true }); // 50 mins = 3000s
    Object.defineProperty(videoEl, 'currentTime', { value: 300, writable: true }); // 5 mins = 300s

    // Simulate pause at 5 minutes
    await act(async () => {
      fireEvent.pause(videoEl);
    });

    // Verify onWatchProgressUpdate received 300 seconds
    expect(onWatchProgressUpdate).toHaveBeenCalledWith(
      'lesson-resume-test',
      10, // 300s / 3000s = 10%
      false,
      300
    );

    // Verify updateLessonWatchProgress was called with exact timestamp (300 seconds)
    expect(updateProgressSpy).toHaveBeenCalledWith(
      'student-1',
      'lesson-resume-test',
      10,
      300,
      1
    );
  });

  it('clicking Resume seeks video to 300s and starts playback', async () => {
    let playCalled = false;
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
          userId="student-1"
          initialLastPositionSeconds={300}
        />
      );
      renderedContainer = container;
    });

    const videoEl = renderedContainer?.querySelector('video') as HTMLVideoElement;
    videoEl.play = vi.fn().mockImplementation(() => {
      playCalled = true;
      return Promise.resolve();
    });

    const resumeBtn = screen.getByRole('button', { name: /Resume \(5:00\)/i });

    await act(async () => {
      fireEvent.click(resumeBtn);
    });

    expect(videoEl.currentTime).toBe(300);
    expect(playCalled).toBe(true);
    expect(screen.queryByText(/Resume playback from 5:00\?/i)).not.toBeInTheDocument();
  });

  it('clicking Start Over resets video to 0s and dismisses prompt', async () => {
    const onWatchProgressUpdate = vi.fn();
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
          userId="student-1"
          initialLastPositionSeconds={300}
          onWatchProgressUpdate={onWatchProgressUpdate}
        />
      );
      renderedContainer = container;
    });

    const videoEl = renderedContainer?.querySelector('video') as HTMLVideoElement;
    videoEl.currentTime = 300;

    const startOverBtn = screen.getByRole('button', { name: /Start Over/i });

    await act(async () => {
      fireEvent.click(startOverBtn);
    });

    expect(videoEl.currentTime).toBe(0);
    expect(screen.queryByText(/Resume playback from 5:00\?/i)).not.toBeInTheDocument();
    expect(onWatchProgressUpdate).toHaveBeenCalledWith(
      'lesson-resume-test',
      0,
      false,
      0
    );
  });

  it('flushes position on unmount so exiting the lesson preserves timestamp', async () => {
    const updateProgressSpy = vi.mocked(courseService.updateLessonWatchProgress);

    let unmountFn: () => void;
    let renderedContainer: HTMLElement | undefined;
    await act(async () => {
      const { unmount, container } = render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
          userId="student-1"
          initialLastPositionSeconds={150}
        />
      );
      unmountFn = unmount;
      renderedContainer = container;
    });

    const videoEl = renderedContainer?.querySelector('video') as HTMLVideoElement;
    expect(videoEl).toBeInTheDocument();
    Object.defineProperty(videoEl, 'duration', { value: 3000, writable: true });
    Object.defineProperty(videoEl, 'currentTime', { value: 300, writable: true }); // 5 minutes

    await act(async () => {
      fireEvent.timeUpdate(videoEl);
    });

    await act(async () => {
      unmountFn!();
    });

    expect(updateProgressSpy).toHaveBeenCalledWith(
      'student-1',
      'lesson-resume-test',
      10, // 300 / 3000 = 10%
      300,
      1
    );
  });
});
