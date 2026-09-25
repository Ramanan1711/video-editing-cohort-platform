import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkshopsPage } from '../../pages/WorkshopsPage';
import { ThemeProvider } from '../../context/ThemeContext';

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-student-1', email: 'student@example.com' },
    profile: {
      id: 'test-student-1',
      full_name: 'Alex Rivera',
      role: 'student',
    },
    signOut: vi.fn(),
  }),
}));

vi.mock('../../lib/courseService', () => ({
  listStudentLiveSessions: vi.fn().mockResolvedValue([
    {
      id: 'session-1',
      title: "B15 W3 MC's Live Session",
      description: 'Week 3 Masterclass: Kinetic typography and pacing drills.',
      starts_at: new Date(Date.now() + 86400000 * 2).toISOString(),
      meeting_url: 'https://zoom.us/j/123456789',
    },
    {
      id: 'session-2',
      title: "B15 W4 MC's Live Session",
      description: 'Week 4 Masterclass: Advanced sound design.',
      starts_at: new Date(Date.now() + 86400000 * 9).toISOString(),
      meeting_url: 'https://zoom.us/j/987654321',
    },
    {
      id: 'session-past',
      title: "B15 W2 MC's Live Session",
      description: 'Week 2 Masterclass: Color grading.',
      starts_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      meeting_url: 'https://zoom.us/rec/w2',
    },
  ]),
}));

describe('WorkshopsPage - Full Screen Workshops Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWorkshops = () => {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/workshops']}>
          <WorkshopsPage />
        </MemoryRouter>
      </ThemeProvider>
    );
  };

  it('renders top navigation bar with active Workshops tab and ProCut Hub branding', async () => {
    renderWorkshops();

    // Top Navigation Brand & Active Tab
    expect(await screen.findByText('ProCut')).toBeInTheDocument();
    expect(screen.getAllByText('Hub').length).toBeGreaterThan(0);

    const workshopsTab = screen.getByRole('button', { name: /^workshops$/i });
    expect(workshopsTab).toBeInTheDocument();
  });

  it('renders Workshops page title, date range filter pill, and sync button', async () => {
    renderWorkshops();

    expect(await screen.findByRole('heading', { level: 1, name: 'Workshops' })).toBeInTheDocument();
    expect(screen.getByText('Start date – End date')).toBeInTheDocument();
    expect(screen.getByTitle('Sync and refresh workshops')).toBeInTheDocument();
  });

  it('renders Upcoming and Completed sub-tabs', async () => {
    renderWorkshops();

    expect(await screen.findByRole('button', { name: 'Upcoming' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
  });

  it('renders workshop items grouped by date matching reference image layout', async () => {
    renderWorkshops();

    // Session Titles
    expect(await screen.findByText("B15 W3 MC's Live Session")).toBeInTheDocument();
    expect(screen.getByText("B15 W4 MC's Live Session")).toBeInTheDocument();

    // Join and options buttons
    const joinButtons = screen.getAllByRole('button', { name: 'Join' });
    expect(joinButtons.length).toBeGreaterThanOrEqual(2);

    const moreButtons = screen.getAllByTitle('More options');
    expect(moreButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('switches between Upcoming and Completed tabs', async () => {
    renderWorkshops();

    await screen.findByText("B15 W3 MC's Live Session");

    const completedTab = screen.getByRole('button', { name: 'Completed' });
    fireEvent.click(completedTab);

    // Watch Recording buttons for completed sessions
    await waitFor(() => {
      const recordingButtons = screen.getAllByRole('button', { name: 'Watch Recording' });
      expect(recordingButtons.length).toBeGreaterThan(0);
    });

    const upcomingTab = screen.getByRole('button', { name: 'Upcoming' });
    fireEvent.click(upcomingTab);

    await waitFor(() => {
      expect(screen.getByText("B15 W3 MC's Live Session")).toBeInTheDocument();
    });
  });

  it('opens session information modal when clicking info icon', async () => {
    renderWorkshops();

    await screen.findByText("B15 W3 MC's Live Session");

    const infoButtons = screen.getAllByTitle('Session details');
    fireEvent.click(infoButtons[0]);

    expect(await screen.findByText('Session Information')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Session' })).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Session Information')).not.toBeInTheDocument();
    });
  });
});

