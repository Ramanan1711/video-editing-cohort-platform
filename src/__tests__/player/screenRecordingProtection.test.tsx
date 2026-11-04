import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('LessonPlayer - Anti-Screen-Recording & Screen Sharing Protection', () => {
  const mockLesson: Lesson = {
    id: 'lesson-security-test',
    module_id: 'module-1',
    title: 'Proprietary System Architecture Masterclass',
    description: 'High-value proprietary production video',
    position: 1,
    video_url: 'https://cdn.example.com/videos/proprietary-lesson.mp4',
    duration_minutes: 45,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('renders anti-capture protection badge and dynamic multi-layer forensic watermarks', async () => {
    await act(async () => {
      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
          userId="student-uuid-12345"
          userEmail="alex.chen@example.com"
          userName="Alex Chen"
          initialWatchPercentage={10}
        />
      );
    });

    // 1. Verify protection status badge in toolbar
    expect(screen.getByTestId('screen-protection-status-badge')).toBeInTheDocument();
    expect(screen.getByText(/Anti-Capture Protected/i)).toBeInTheDocument();

    // 2. Verify discrete corner forensic watermark is rendered with student's credentials (clean enterprise LMS style)
    const watermark = screen.getByTestId('student-forensic-watermark');
    expect(watermark).toBeInTheDocument();
    expect(watermark).toHaveTextContent('Alex Chen');
    expect(watermark).toHaveTextContent('alex.chen@example.com');
    expect(watermark).toHaveTextContent('Protected Content · Iunoware Academy');
    expect(watermark).toHaveClass('bottom-12', 'right-4');

    // 3. Verify screen center is completely clean and unobstructed (no intrusive tiled grid)
    expect(screen.queryByTestId('student-forensic-tiled-grid')).not.toBeInTheDocument();
  });

  it('enforces disablePictureInPicture and nodownload attributes on the video element', async () => {
    let container: HTMLElement;
    await act(async () => {
      const rendered = render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
        />
      );
      container = rendered.container;
    });

    const videoEl = container!.querySelector('video');
    expect(videoEl).toBeInTheDocument();
    expect(videoEl).toHaveAttribute('disablePictureInPicture');
    expect(videoEl?.getAttribute('controlsList')).toContain('nodownload');
  });

  it('blocks right-click context menu on the video player container to prevent saving/inspecting video source', async () => {
    let container: HTMLElement;
    await act(async () => {
      const rendered = render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
        />
      );
      container = rendered.container;
    });

    const videoViewport = container!.querySelector('[aria-label*="Video player viewport"]');
    expect(videoViewport).toBeInTheDocument();

    const allowed = fireEvent.contextMenu(videoViewport!);
    expect(allowed).toBe(false);
  });

  it('immediately halts playback and renders restriction shield when PrintScreen key is pressed', async () => {
    await act(async () => {
      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
          userId="student-uuid-12345"
        />
      );
    });

    // Verify shield is initially not present
    expect(screen.queryByTestId('screen-protection-shield')).not.toBeInTheDocument();

    // Trigger PrintScreen keydown
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PrintScreen', bubbles: true }));
    });

    // Verify protection shield covers the player
    const shield = screen.getByTestId('screen-protection-shield');
    expect(shield).toBeInTheDocument();
    expect(shield).toHaveTextContent(/Content Protection Active/i);
    expect(shield).toHaveTextContent(/Screen capture hotkey \(PrintScreen\) detected/i);

    // Clicking resume button clears the restriction shield
    const resumeBtn = screen.getByRole('button', { name: /I Have Stopped Recording — Resume Playback/i });
    act(() => {
      fireEvent.click(resumeBtn);
    });

    expect(screen.queryByTestId('screen-protection-shield')).not.toBeInTheDocument();
  });

  it('triggers restriction shield when macOS screen capture shortcut (Cmd+Shift+4) or snipping tool (Cmd+Shift+S) is triggered', async () => {
    await act(async () => {
      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
        />
      );
    });

    // Simulate Cmd+Shift+4 (macOS capture shortcut)
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '4',
          metaKey: true,
          shiftKey: true,
          bubbles: true,
        })
      );
    });

    expect(screen.getByTestId('screen-protection-shield')).toBeInTheDocument();
    expect(screen.getByText(/macOS screen recording \/ capture shortcut/i)).toBeInTheDocument();
  });

  it('triggers restriction shield immediately when Cmd+Shift modifier combination is pressed before any digit (macOS M-Series hardware protection)', async () => {
    await act(async () => {
      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
        />
      );
    });

    expect(screen.queryByTestId('screen-protection-shield')).not.toBeInTheDocument();

    // User presses Meta (Cmd) + Shift on MacBook
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Shift',
          metaKey: true,
          shiftKey: true,
          bubbles: true,
        })
      );
    });

    // Verify protection shield activates immediately before user can press 3, 4, or 5
    expect(screen.getByTestId('screen-protection-shield')).toBeInTheDocument();
    expect(screen.getByText(/macOS screen recording \/ capture shortcut/i)).toBeInTheDocument();
  });

  it('pauses playback without triggering restriction shield when window loses focus (split-screen multitasking / taking notes)', async () => {
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause');

    await act(async () => {
      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
        />
      );
    });

    expect(screen.queryByTestId('screen-protection-shield')).not.toBeInTheDocument();

    // Simulate video playing
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });

    // Trigger window blur (fired when student clicks into notes app in split-screen mode)
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    // Verify video paused to preserve student progress
    expect(pauseSpy).toHaveBeenCalled();

    // Crucial UX Fix: Must NOT lock out the student or show restriction shield
    expect(screen.queryByTestId('screen-protection-shield')).not.toBeInTheDocument();
    expect(screen.queryByText(/Screen capture or window focus lost/i)).not.toBeInTheDocument();
  });

  it('pauses playback without triggering restriction shield when tab is switched or minimized (visibilitychange)', async () => {
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause');

    await act(async () => {
      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
        />
      );
    });

    // Simulate video playing
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });

    // Mock document.visibilityState to 'hidden'
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
      writable: true,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(pauseSpy).toHaveBeenCalled();
    expect(screen.queryByTestId('screen-protection-shield')).not.toBeInTheDocument();
    expect(screen.queryByText(/Window lost focus while video playback was active/i)).not.toBeInTheDocument();
  });

  it('does not lock out player if legacy focus lost restriction was previously in sessionStorage', async () => {
    sessionStorage.setItem('iunoware_capture_detected', 'Screen capture or window focus lost');

    await act(async () => {
      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
        />
      );
    });

    expect(screen.queryByTestId('screen-protection-shield')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('iunoware_capture_detected')).toBeNull();
  });

  it('intercepts getDisplayMedia screen sharing calls and restricts video player', async () => {
    // Mock navigator.mediaDevices.getDisplayMedia
    const originalMediaDevices = navigator.mediaDevices;
    const mockGetDisplayMedia = vi.fn().mockResolvedValue({});

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getDisplayMedia: mockGetDisplayMedia,
      },
      configurable: true,
      writable: true,
    });

    let rendered: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
        />
      );
    });

    // Simulate an external script or WebRTC session initiating screen sharing
    await act(async () => {
      try {
        await navigator.mediaDevices.getDisplayMedia({ video: true });
      } catch {
        // noop
      }
    });

    // Verify restriction shield is activated
    expect(screen.getByTestId('screen-protection-shield')).toBeInTheDocument();
    expect(screen.getByText(/Screen sharing or display capture session initiated in browser/i)).toBeInTheDocument();

    // Unmount before restoring mediaDevices property
    act(() => {
      rendered.unmount();
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
      writable: true,
    });
  });

  it('mounts player in restricted blackout mode if screen recording shortcut was initiated on student dashboard prior to entering course', async () => {
    // Simulate user pressing Cmd+Shift+5 while browsing /student/dashboard
    sessionStorage.setItem(
      'iunoware_capture_detected',
      'macOS screen recording / capture shortcut (Cmd+Shift+3/4/5) detected on portal'
    );

    await act(async () => {
      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
        />
      );
    });

    // Player must mount with the shield active, preventing pre-recorded playback
    expect(screen.getByTestId('screen-protection-shield')).toBeInTheDocument();
    expect(screen.getByText(/macOS screen recording \/ capture shortcut \(Cmd\+Shift\+3\/4\/5\) detected on portal/i)).toBeInTheDocument();

    // Clean up sessionStorage
    sessionStorage.removeItem('iunoware_capture_detected');
  });

  it('immediately triggers restriction shield when portal security event is received', async () => {
    await act(async () => {
      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
        />
      );
    });

    expect(screen.queryByTestId('screen-protection-shield')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('iunoware:security-alert', {
          detail: { reason: 'Screen recording initiated in background' },
        })
      );
    });

    expect(screen.getByTestId('screen-protection-shield')).toBeInTheDocument();
    expect(screen.getByText(/Screen recording initiated in background/i)).toBeInTheDocument();
  });
});
