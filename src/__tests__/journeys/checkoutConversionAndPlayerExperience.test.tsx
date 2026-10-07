import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LessonPlayer } from '../../components/student/StudentPlayerView';
import { CelebrationOnboardingModal } from '../../components/student/CelebrationOnboardingModal';
import {
  setPendingCohortCheckout,
  getPendingCohortCheckout,
  clearPendingCohortCheckout,
  markJustEnrolledCohort,
  consumeJustEnrolledCohort,
  hasSeenCohortOnboarding,
  markCohortOnboardingSeen,
} from '../../lib/cohortCheckoutPersistence';
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
    getSecureAssetUrl: vi.fn().mockResolvedValue('https://cdn.test/video.mp4'),
    updateLessonWatchProgress: vi.fn().mockResolvedValue(undefined),
    markLessonComplete: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Pillar 3: Critical User Journeys (Checkout Conversion & Player Experience)', () => {
  const mockLesson: Lesson = {
    id: 'lesson-sprint-1',
    module_id: 'module-1',
    title: 'Kinetic Pacing and Jump Cut Mastery',
    description: 'Master fast-paced storytelling and kinetic retention techniques.',
    position: 1,
    video_url: 'https://cdn.test/video.mp4',
    duration_minutes: 15,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('Part 1: Checkout & Conversion Flow Persistence & Celebration', () => {
    it('preserves cohort selection across registration and marks enrollment celebration', () => {
      // 1. Visitor clicks cohort CTA on landing page
      setPendingCohortCheckout('cohort-batch-15', '15-Day Video Sprint Batch 15', 4999, 'INR');

      const restored = getPendingCohortCheckout();
      expect(restored).not.toBeNull();
      expect(restored?.cohortId).toBe('cohort-batch-15');
      expect(restored?.cohortName).toBe('15-Day Video Sprint Batch 15');

      // 2. Once payment is verified, mark just enrolled
      markJustEnrolledCohort(restored!.cohortId, restored!.cohortName);
      clearPendingCohortCheckout();

      expect(getPendingCohortCheckout()).toBeNull();

      // 3. On dashboard load, consume marker
      const justEnrolled = consumeJustEnrolledCohort();
      expect(justEnrolled).not.toBeNull();
      expect(justEnrolled?.cohortId).toBe('cohort-batch-15');
      expect(justEnrolled?.cohortName).toBe('15-Day Video Sprint Batch 15');

      // 4. Ensure it can only be consumed once
      expect(consumeJustEnrolledCohort()).toBeNull();
    });

    it('tracks onboarding completion flag per user and cohort', () => {
      expect(hasSeenCohortOnboarding('cohort-batch-15', 'user-123')).toBe(false);

      markCohortOnboardingSeen('cohort-batch-15', 'user-123');
      expect(hasSeenCohortOnboarding('cohort-batch-15', 'user-123')).toBe(true);
      expect(hasSeenCohortOnboarding('cohort-batch-15', 'user-456')).toBe(false);
    });

    it('renders Celebratory First-Time Onboarding Modal with cohort details and triggers launch', () => {
      const handleClose = vi.fn();
      const handleLaunch = vi.fn();

      render(
        <CelebrationOnboardingModal
          isOpen={true}
          onClose={handleClose}
          cohortName="15-Day Video Sprint Batch 15"
          cohortId="cohort-batch-15"
          studentName="Jordan"
          onLaunchLesson1={handleLaunch}
        />
      );

      // Verify celebratory contents
      expect(screen.getByText(/Welcome to the Sprint, Jordan!/i)).toBeInTheDocument();
      expect(screen.getByText(/15-Day Video Sprint Batch 15/i)).toBeInTheDocument();
      expect(screen.getByText(/Production Seat Reserved & Active/i)).toBeInTheDocument();
      expect(screen.getByText(/Join Private WhatsApp Mentorship/i)).toBeInTheDocument();
      expect(screen.getByText(/Day 1 Production Mission/i)).toBeInTheDocument();

      // Click primary CTA
      const launchBtn = screen.getByRole('button', { name: /Let's Cut! Launch Lesson 1/i });
      fireEvent.click(launchBtn);

      expect(handleClose).toHaveBeenCalled();
      expect(handleLaunch).toHaveBeenCalled();
    });
  });

  describe('Part 2: Student Video Player Experience (Keyboard Controls & Optimistic UI)', () => {
    it('provides keyboard controls for Space (play/pause), F (fullscreen), and ArrowLeft/Right (seek)', async () => {
      const onWatchProgressUpdate = vi.fn();
      const onToggleComplete = vi.fn();

      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={onToggleComplete}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
          userId="usr-1"
          cohortId="cohort-1"
          onWatchProgressUpdate={onWatchProgressUpdate}
        />
      );

      const videoEl = document.querySelector('video') as HTMLVideoElement;
      expect(videoEl).toBeInTheDocument();

      let isPaused = true;
      Object.defineProperty(videoEl, 'paused', {
        get: () => isPaused,
        set: (v: boolean) => { isPaused = v; },
        configurable: true,
      });
      Object.defineProperty(videoEl, 'duration', { value: 600, configurable: true, writable: true });
      Object.defineProperty(videoEl, 'currentTime', { value: 50, configurable: true, writable: true });

      // Mock play and pause methods on video element
      const playSpy = vi.spyOn(videoEl, 'play').mockImplementation(async () => {
        isPaused = false;
      });
      const pauseSpy = vi.spyOn(videoEl, 'pause').mockImplementation(() => {
        isPaused = true;
      });

      // 1. Space: Play
      fireEvent.keyDown(window, { code: 'Space' });
      expect(playSpy).toHaveBeenCalled();
      expect(screen.getByTestId('video-hud-overlay')).toHaveTextContent(/Playing/i);

      // Space: Pause
      fireEvent.keyDown(window, { code: 'Space' });
      expect(pauseSpy).toHaveBeenCalled();
      expect(screen.getByTestId('video-hud-overlay')).toHaveTextContent(/Paused/i);

      // 2. ArrowLeft: Rewind 5s
      fireEvent.keyDown(window, { code: 'ArrowLeft' });
      expect(videoEl.currentTime).toBe(45);
      expect(screen.getByTestId('video-hud-overlay')).toHaveTextContent(/-5s Rewind/i);

      // 3. ArrowRight: Fast Forward 5s
      fireEvent.keyDown(window, { code: 'ArrowRight' });
      expect(videoEl.currentTime).toBe(50);
      expect(screen.getByTestId('video-hud-overlay')).toHaveTextContent(/\+5s Skip/i);

      // 4. 'F': Fullscreen
      const requestFullscreenSpy = vi.fn().mockResolvedValue(undefined);
      Element.prototype.requestFullscreen = requestFullscreenSpy;
      act(() => {
        fireEvent.keyDown(window, { key: 'f' });
      });
      expect(screen.getByTestId('video-hud-overlay')).toHaveTextContent(/Fullscreen/i);
    });

    it('ignores keyboard shortcuts when user is typing in input or textarea fields', () => {
      render(
        <div>
          <input data-testid="test-input" />
          <LessonPlayer
            lesson={mockLesson}
            completed={false}
            onToggleComplete={vi.fn()}
            prevLesson={null}
            nextLesson={null}
            onSelectLesson={vi.fn()}
            userId="usr-1"
            cohortId="cohort-1"
          />
        </div>
      );

      const videoEl = document.querySelector('video') as HTMLVideoElement;
      const playSpy = vi.spyOn(videoEl, 'play').mockResolvedValue(undefined);
      const inputEl = screen.getByTestId('test-input');

      inputEl.focus();
      expect(document.activeElement).toBe(inputEl);

      fireEvent.keyDown(window, { code: 'Space' });
      expect(playSpy).not.toHaveBeenCalled();
      expect(screen.queryByTestId('video-hud-overlay')).not.toBeInTheDocument();
    });

    it('optimistically updates checkmark and completion status immediately when reaching >= 80% watch progress', async () => {
      const onWatchProgressUpdate = vi.fn();
      let slowMutationResolve: () => void;
      const slowMutationPromise = new Promise<void>((resolve) => {
        slowMutationResolve = resolve;
      });

      vi.mocked(courseService.updateLessonWatchProgress).mockReturnValueOnce(slowMutationPromise);

      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={vi.fn()}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
          userId="usr-1"
          cohortId="cohort-1"
          onWatchProgressUpdate={onWatchProgressUpdate}
        />
      );

      const videoEl = document.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(videoEl, 'duration', { value: 100, writable: true });
      Object.defineProperty(videoEl, 'currentTime', { value: 85, writable: true }); // 85%

      // Trigger time update past 80%
      act(() => {
        fireEvent.timeUpdate(videoEl);
      });

      // Verification: Checkmark and Completed state must appear OPTIMISTICALLY in DOM immediately
      expect(screen.getByText(/✓ Completed \(≥80% watched\)/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Completed/i })).toBeInTheDocument();

      // onWatchProgressUpdate callback must be triggered with autoCompleted = true
      expect(onWatchProgressUpdate).toHaveBeenCalledWith(
        'lesson-sprint-1',
        85,
        true
      );

      // Now resolve slow background mutation
      await act(async () => {
        slowMutationResolve!();
      });
    });

    it('optimistically toggles completion state on button click', () => {
      const onToggleComplete = vi.fn();

      render(
        <LessonPlayer
          lesson={mockLesson}
          completed={false}
          onToggleComplete={onToggleComplete}
          prevLesson={null}
          nextLesson={null}
          onSelectLesson={vi.fn()}
          userId="usr-1"
          cohortId="cohort-1"
          initialWatchPercentage={85} // > 80% so button is unlocked
        />
      );

      const completeBtn = screen.getByRole('button', { name: /Completed/i });
      fireEvent.click(completeBtn);

      expect(onToggleComplete).toHaveBeenCalledTimes(1);
    });
  });
});
