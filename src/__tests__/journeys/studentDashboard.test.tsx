import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentDashboard } from '../../pages/StudentDashboard';
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
  listCohorts: vi.fn().mockResolvedValue([
    {
      id: 'cohort-1',
      name: 'B15 - Full Stack Video Editing Cohort',
      title: 'B15 - Full Stack Video Editing Cohort',
      description: 'Comprehensive video editing cohort',
      status: 'published',
    },
    {
      id: 'cohort-2',
      name: 'Python Masterclass Cohort',
      title: 'Python Masterclass Cohort',
      description: 'Learn Python programming',
      status: 'published',
    },
    {
      id: 'cohort-3',
      name: 'Batch - 9 Social Media Video Editing Cohort',
      title: 'Batch - 9 Social Media Video Editing Cohort',
      description: 'Social media video editing',
      status: 'published',
    },
  ]),
  listModules: vi.fn().mockResolvedValue([
    {
      id: 'mod-1',
      cohort_id: 'cohort-1',
      title: 'Module 1: Foundations',
      position: 1,
      lessons: [
        {
          id: 'les-1',
          module_id: 'mod-1',
          title: 'Lesson 1: Intro to Pacing',
          position: 1,
          video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          duration_minutes: 15,
        },
      ],
    },
    {
      id: 'mod-2',
      cohort_id: 'cohort-2',
      title: 'Python Basics',
      position: 1,
      lessons: [],
    },
    {
      id: 'mod-3',
      cohort_id: 'cohort-3',
      title: 'Shorts & Reels',
      position: 1,
      lessons: [],
    },
  ]),
  getStudentCourseData: vi.fn().mockResolvedValue({
    cohort: {
      id: 'cohort-1',
      name: 'B15 - Full Stack Video Editing Cohort',
      description: 'Comprehensive video editing cohort',
      status: 'published',
    },
    modules: [
      {
        id: 'mod-1',
        cohort_id: 'cohort-1',
        title: 'Module 1: Foundations',
        position: 1,
        lessons: [
          {
            id: 'les-1',
            module_id: 'mod-1',
            title: 'Lesson 1: Intro to Pacing',
            position: 1,
            video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            duration_minutes: 15,
          },
        ],
      },
    ],
    progress: [],
    enrolledCohorts: [
      {
        id: 'cohort-1',
        name: 'B15 - Full Stack Video Editing Cohort',
      },
    ],
  }),
  listMySubmissions: vi.fn().mockResolvedValue([]),
  listStudentLiveSessions: vi.fn().mockResolvedValue([]),
  listStudentAnnouncements: vi.fn().mockResolvedValue([]),
  listAssignments: vi.fn().mockResolvedValue([]),
  listLessonResources: vi.fn().mockResolvedValue([]),
  markLessonComplete: vi.fn().mockResolvedValue(true),
  updateLessonWatchProgress: vi.fn().mockResolvedValue(undefined),
  parseVideoUrl: vi.fn().mockReturnValue({ type: 'youtube', id: 'dQw4w9WgXcQ' }),
  calculateLearningTime: vi.fn().mockReturnValue('0h 0m'),
  calculateStreak: vi.fn().mockReturnValue(1),
  formatFileSize: vi.fn().mockReturnValue('10 MB'),
}));

vi.mock('../../lib/gamificationService', () => ({
  calculateGamificationProfile: vi.fn().mockReturnValue({
    level: 1,
    tierTitle: 'Apprentice Cutter',
    totalXp: 150,
    progressPercent: 30,
    badges: [],
    recentHeatmap: [],
  }),
  syncGamificationProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/recommendationService', () => ({
  generateSmartRecommendations: vi.fn().mockReturnValue([]),
}));

describe('StudentDashboard - Courses Catalog & Player View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDashboard = (initialEntries = ['/student/dashboard']) => {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <StudentDashboard />
        </MemoryRouter>
      </ThemeProvider>
    );
  };

  it('renders top navigation bar with ProCut Hub branding and Courses active tab', async () => {
    renderDashboard();

    // Top Navigation Brand & Active Tab
    expect(await screen.findByText('ProCut')).toBeInTheDocument();
    expect(screen.getAllByText('Hub').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^courses$/i })).toBeInTheDocument();
  });

  it('renders Courses page header with dynamic stats matching reference image', async () => {
    renderDashboard();

    // Header Title
    expect(await screen.findByRole('heading', { level: 1, name: 'Courses' })).toBeInTheDocument();

    // Dynamic stats: 3 courses • 1 in progress • 0 completed
    expect(screen.getByText(/3 courses • 1 in progress • 0 completed/i)).toBeInTheDocument();

    // Sync / Refresh button
    expect(screen.getByRole('button', { name: /sync and refresh courses/i })).toBeInTheDocument();
  });

  it('renders pill search bar and filter controls', async () => {
    renderDashboard();

    // Pill Search bar with Course selector
    expect(await screen.findByPlaceholderText('Search by course, chapter, or section title')).toBeInTheDocument();
    expect(screen.getByText('Course')).toBeInTheDocument();

    // Filter Pills
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In Progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expired' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paid' })).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
  });

  it('renders 3-column courses grid with active course card and locked cards', async () => {
    renderDashboard();

    // Card 1: Enrolled / Active Cohort
    expect(await screen.findByText('B15 - Full Stack Video Editing Cohort')).toBeInTheDocument();
    expect(screen.getByText('FULL STACK')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByText(/12 new chapters recently added/i)).toBeInTheDocument();

    // Card 2: Python Masterclass Cohort (Locked)
    expect(screen.getByText('Python Masterclass Cohort')).toBeInTheDocument();

    // Card 3: Batch - 9 Social Media Video Editing Cohort (Locked)
    expect(screen.getByText('Batch - 9 Social Media Video Editing Cohort')).toBeInTheDocument();

    // Locked Cards have "Buy now to unlock" buttons
    const buyButtons = screen.getAllByRole('button', { name: 'Buy now to unlock' });
    expect(buyButtons.length).toBe(2);
  });

  it('transitions from Courses Catalog to Curriculum Player when clicking Continue, and allows navigation back', async () => {
    renderDashboard();

    // Click Continue on Card 1
    const continueBtn = await screen.findByRole('button', { name: 'Continue' });
    fireEvent.click(continueBtn);

    // Curriculum Player view is displayed with "Back to Courses" button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to courses/i })).toBeInTheDocument();
    });

    // Clicking "Back to Courses" returns to the Catalog view
    const backBtn = screen.getByRole('button', { name: /back to courses/i });
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Courses' })).toBeInTheDocument();
    });
  });

  it('filters courses when clicking filter pills', async () => {
    renderDashboard();

    await screen.findByText('B15 - Full Stack Video Editing Cohort');

    // Clicking "In Progress" should only show the in-progress course
    const inProgressBtn = screen.getByRole('button', { name: 'In Progress' });
    fireEvent.click(inProgressBtn);

    expect(screen.getByText('B15 - Full Stack Video Editing Cohort')).toBeInTheDocument();
    expect(screen.queryByText('Python Masterclass Cohort')).not.toBeInTheDocument();
    expect(screen.queryByText('Batch - 9 Social Media Video Editing Cohort')).not.toBeInTheDocument();

    // Clicking "All" restores all cards
    const allBtn = screen.getByRole('button', { name: 'All' });
    fireEvent.click(allBtn);

    expect(screen.getByText('Python Masterclass Cohort')).toBeInTheDocument();
  });
});
