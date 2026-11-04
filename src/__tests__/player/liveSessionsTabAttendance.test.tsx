import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveSessionsTab } from '../../components/student/player/LiveSessionsTab';
import * as attendanceService from '../../lib/attendanceService';
import type { StudentLiveSession } from '../../lib/courseService';

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    info: vi.fn(),
  }),
}));

vi.mock('../../lib/attendanceService', () => ({
  checkInToSession: vi.fn().mockResolvedValue({
    id: 'att-123',
    session_id: 'session-1',
    status: 'present',
    join_time: '2026-11-04T12:00:00Z',
  }),
  getStudentAttendanceHistory: vi.fn().mockResolvedValue([]),
}));

describe('LiveSessionsTab - Live Session Attendance Integration', () => {
  const mockSessions: StudentLiveSession[] = [
    {
      id: 'session-1',
      title: 'Week 1 Live Editing Critique & Mentorship',
      description: 'Hands-on timeline review and feedback on cut pace.',
      starts_at: '2026-11-04T14:00:00Z',
      meeting_url: 'https://meet.google.com/abc-defg-hij',
    },
    {
      id: 'session-2',
      title: 'Sound Design & Foley Workshop',
      description: 'Audio ducking and layering masterclass.',
      starts_at: '2026-11-08T15:00:00Z',
      meeting_url: 'https://zoom.us/j/987654321',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders live session cards with join buttons', () => {
    render(<LiveSessionsTab liveSessions={mockSessions} nowTimestamp={Date.now()} />);

    expect(screen.getByText('Week 1 Live Editing Critique & Mentorship')).toBeInTheDocument();
    expect(screen.getByText('Sound Design & Foley Workshop')).toBeInTheDocument();
    expect(screen.getByTestId('join-session-btn-session-1')).toBeInTheDocument();
    expect(screen.getByTestId('join-session-btn-session-2')).toBeInTheDocument();
  });

  it('calls checkInToSession when student clicks Join Video Room and opens meeting URL', async () => {
    const mockWindowOpen = vi.spyOn(window, 'open').mockReturnValue({ location: { href: '' } } as unknown as Window);

    render(
      <LiveSessionsTab
        liveSessions={mockSessions}
        nowTimestamp={Date.now()}
        userId="student-uuid-456"
      />
    );

    const joinBtn = screen.getByTestId('join-session-btn-session-1');
    fireEvent.click(joinBtn);

    // Verify checkInToSession was invoked with session-1
    expect(attendanceService.checkInToSession).toHaveBeenCalledWith('session-1');

    await waitFor(() => {
      // Verify attendance badge renders on successful check-in
      expect(screen.getByText(/Attendance Verified for Certificate/i)).toBeInTheDocument();
      expect(screen.getByText(/Rejoin Video Room/i)).toBeInTheDocument();
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringMatching(/attendance checked in/i));
    });

    // Verify meeting URL opened in a new tab
    expect(mockWindowOpen).toHaveBeenCalled();
  });

  it('loads existing attendance history on mount and marks attended sessions as verified', async () => {
    vi.mocked(attendanceService.getStudentAttendanceHistory).mockResolvedValueOnce([
      {
        id: 'att-existing',
        session_id: 'session-2',
        student_id: 'student-uuid-456',
        status: 'present',
        cohort_id: 'cohort-1',
        join_time: '2026-11-01T12:00:00Z',
        duration_minutes: 60,
        notes: null,
        verified_by: null,
        check_in_method: 'self_check_in',
        created_at: '2026-11-01T12:00:00Z',
        updated_at: '2026-11-01T12:00:00Z',
      },
    ]);

    render(
      <LiveSessionsTab
        liveSessions={mockSessions}
        nowTimestamp={Date.now()}
        userId="student-uuid-456"
      />
    );

    await waitFor(() => {
      // Session 2 should already be verified
      expect(screen.getByText(/Attendance Verified for Certificate/i)).toBeInTheDocument();
      expect(screen.getByText(/Rejoin Video Room \(Zoom \/ Meet\)/i)).toBeInTheDocument();
    });
  });

  it('opens video room even if checkInToSession throws an error so student is not locked out of class', async () => {
    const mockWindowOpen = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    vi.mocked(attendanceService.checkInToSession).mockRejectedValueOnce(new Error('Network error'));

    render(
      <LiveSessionsTab
        liveSessions={mockSessions}
        nowTimestamp={Date.now()}
        userId="student-uuid-456"
      />
    );

    const joinBtn = screen.getByTestId('join-session-btn-session-1');
    fireEvent.click(joinBtn);

    expect(attendanceService.checkInToSession).toHaveBeenCalledWith('session-1');

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled();
    });
  });
});
