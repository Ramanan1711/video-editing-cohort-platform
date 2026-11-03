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
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

    // 2. Verify dynamic forensic wandering watermark is rendered with student's credentials
    const watermark = screen.getByTestId('student-forensic-watermark');
    expect(watermark).toBeInTheDocument();
    expect(watermark).toHaveTextContent('Alex Chen');
    expect(watermark).toHaveTextContent('alex.chen@example.com');
    expect(watermark).toHaveTextContent('Protected Content · Iunoware Academy');

    // 3. Verify diagonal repeating tiled forensic watermark grid
    expect(screen.getByTestId('student-forensic-tiled-grid')).toBeInTheDocument();

    // 4. Verify corner forensic session stamp
    const cornerStamp = screen.getByTestId('student-forensic-corner-stamp');
    expect(cornerStamp).toBeInTheDocument();
    expect(cornerStamp).toHaveTextContent('alex.chen@example.com');
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

  it('triggers restriction shield when window loses focus (e.g. snipping tool overlay or external recorder)', async () => {
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

    // Trigger window blur (fired when macOS Cmd+Shift+4 cursor opens or Windows Snipping Tool is activated)
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(screen.getByTestId('screen-protection-shield')).toBeInTheDocument();
    expect(screen.getByText(/Screen capture or window focus lost/i)).toBeInTheDocument();
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
});
