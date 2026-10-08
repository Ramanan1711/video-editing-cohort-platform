import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SprintChallengeTracker } from '../../components/internship/SprintChallengeTracker';
import * as internshipService from '../../lib/internshipService';
import type { InternshipDayStatus } from '../../lib/internshipService';

vi.mock('../../lib/internshipService', async () => {
  const actual = await vi.importActual('../../lib/internshipService');
  return {
    ...actual,
    submitDailyChallenge: vi.fn(),
  };
});

describe('SprintChallengeTracker with Dynamic Challenge Upload', () => {
  const mockSprintDays: InternshipDayStatus[] = [
    {
      dayNumber: 1,
      title: 'Day 1: Timeline Assembly & Rough Cut',
      status: 'accepted',
      isUnlocked: true,
      challenge: {
        id: '11111111-1111-1111-1111-111111111111',
        cohort_id: 'cohort-1',
        day_number: 1,
        title: 'Timeline Assembly & Rough Cut',
        description: 'Sync dual-system audio and assemble the initial A-roll edit.',
        instructions: null,
        starter_files_url: null,
        track_type: 'general',
        submission_type: 'file',
        deadline_hours: 24,
      },
      submission: {
        id: 'sub-1',
        challenge_id: '11111111-1111-1111-1111-111111111111',
        user_id: 'user-1',
        submission_url: 'https://xyz.supabase.co/storage/v1/object/submissions/user-1/rough_cut.mp4',
        notes: 'Synced audio using timecode markers.',
        status: 'accepted',
        score: 95,
        mentor_feedback: 'Crisp sync and tight cuts.',
        submitted_at: '2026-10-01T10:00:00Z',
      },
    },
    {
      dayNumber: 2,
      title: 'Day 2: Pacing & J-Cut Dialog Polish',
      status: 'todo',
      isUnlocked: true,
      challenge: {
        id: '22222222-2222-2222-2222-222222222222',
        cohort_id: 'cohort-1',
        day_number: 2,
        title: 'Pacing & J-Cut Dialog Polish',
        description: 'Refine conversational pacing using J-cuts and L-cuts.',
        instructions: 'Export as 1080p MP4 or upload to Frame.io.',
        starter_files_url: null,
        track_type: 'general',
        submission_type: 'file',
        deadline_hours: 24,
      },
      submission: null,
    },
    {
      dayNumber: 3,
      title: 'Day 3: B-Roll & Visual Anchoring',
      status: 'locked',
      isUnlocked: false,
      challenge: {
        id: '33333333-3333-3333-3333-333333333333',
        cohort_id: 'cohort-1',
        day_number: 3,
        title: 'B-Roll & Visual Anchoring',
        description: 'Layer illustrative B-roll to cover jump cuts.',
        instructions: null,
        starter_files_url: null,
        track_type: 'general',
        submission_type: 'file',
        deadline_hours: 24,
      },
      submission: null,
    },
  ];

  const mockOnRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sprint header, metrics, and day cards', () => {
    render(
      <SprintChallengeTracker
        cohortId="cohort-1"
        cohortName="CineSprint #15"
        userId="user-1"
        studentName="Alex"
        sprintDays={mockSprintDays}
        completedCount={1}
        totalDays={3}
        streakCount={4}
        overallScore={95}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText(/3-Day Production Sprint/i)).toBeInTheDocument();
    expect(screen.getByText(/4 Days 🔥/i)).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('Timeline Assembly & Rough Cut')).toBeInTheDocument();
    expect(screen.getByText('Pacing & J-Cut Dialog Polish')).toBeInTheDocument();
  });

  it('opens challenge modal with DynamicChallengeSubmissionBox when clicking an active day', () => {
    render(
      <SprintChallengeTracker
        cohortId="cohort-1"
        cohortName="CineSprint #15"
        userId="user-1"
        studentName="Alex"
        sprintDays={mockSprintDays}
        completedCount={1}
        totalDays={3}
        streakCount={4}
        overallScore={95}
        onRefresh={mockOnRefresh}
      />
    );

    // Click Day 2 (Active task)
    fireEvent.click(screen.getByText('Pacing & J-Cut Dialog Polish'));

    // Modal opens
    expect(screen.getByText('Day 2: Pacing & J-Cut Dialog Polish')).toBeInTheDocument();
    expect(screen.getByText(/Submission Method/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /direct file upload/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cloud \/ external link/i })).toBeInTheDocument();
  });

  it('submits challenge via DynamicChallengeSubmissionBox and triggers submitDailyChallenge', async () => {
    vi.mocked(internshipService.submitDailyChallenge).mockResolvedValueOnce({
      id: 'sub-new',
      challenge_id: '22222222-2222-2222-2222-222222222222',
      user_id: 'user-1',
      submission_url: 'https://app.frame.io/presentations/test-cut',
      notes: 'Applied audio crossfades.',
      status: 'pending',
      score: null,
      mentor_feedback: null,
      submitted_at: new Date().toISOString(),
    });

    render(
      <SprintChallengeTracker
        cohortId="cohort-1"
        cohortName="CineSprint #15"
        userId="user-1"
        studentName="Alex"
        sprintDays={mockSprintDays}
        completedCount={1}
        totalDays={3}
        streakCount={4}
        overallScore={95}
        onRefresh={mockOnRefresh}
      />
    );

    // Open Day 2 modal
    fireEvent.click(screen.getByText('Pacing & J-Cut Dialog Polish'));

    // Switch to Cloud Link
    fireEvent.click(screen.getByRole('button', { name: /cloud \/ external link/i }));

    const urlInput = screen.getByPlaceholderText(/https:\/\/loom\.com/i);
    fireEvent.change(urlInput, { target: { value: 'https://app.frame.io/presentations/test-cut' } });

    const notesInput = screen.getByPlaceholderText(/describe how you approached the challenge/i);
    fireEvent.change(notesInput, { target: { value: 'Applied audio crossfades.' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /submit challenge/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(internshipService.submitDailyChallenge).toHaveBeenCalledWith(
        'user-1',
        '22222222-2222-2222-2222-222222222222',
        'https://app.frame.io/presentations/test-cut',
        'Applied audio crossfades.'
      );
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });
});
