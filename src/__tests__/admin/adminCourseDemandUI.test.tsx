import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminOperations } from '../../pages/AdminOperations';
import { queryCache } from '../../lib/queryCache';

// Mock useAuth
vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', email: 'admin@cutcraft.dev' },
    profile: {
      id: 'admin-1',
      full_name: 'Lead Admin',
      role: 'admin',
      admin_role: 'super_admin',
    },
    signOut: vi.fn(),
  }),
}));

// Mock useToast
vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

// Mock Supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}));

// Mock Notification Service
vi.mock('../../lib/notificationService', () => ({
  listUserNotifications: vi.fn().mockResolvedValue([]),
  markNotificationAsRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsAsRead: vi.fn().mockResolvedValue(undefined),
}));

// Mock Admin and Course Services
vi.mock('../../lib/adminService', async () => {
  const actual = await vi.importActual('../../lib/adminService');
  return {
    ...actual,
    getAdminStats: vi.fn().mockResolvedValue({
      users: 100,
      students: 80,
      mentors: 15,
      admins: 5,
      cohorts: 6,
      enrollments: 75,
      posts: 30,
      pendingSubmissions: 4,
      reviewedSubmissions: 50,
      announcements: 10,
      sessions: 8,
    }),
    getCourseDemandReport: vi.fn().mockResolvedValue([
      {
        courseId: 'c-web',
        title: 'Full Stack React & Node',
        slug: 'full-stack-react',
        trackType: 'coding',
        cohortsCount: 3,
        enrolledStudentsCount: 60,
        status: 'published',
        popularitySharePct: 67,
      },
      {
        courseId: 'c-video',
        title: 'Commercial Video Editing',
        slug: 'commercial-video',
        trackType: 'non_coding',
        cohortsCount: 2,
        enrolledStudentsCount: 30,
        status: 'published',
        popularitySharePct: 33,
      },
      {
        courseId: 'c-audio',
        title: 'Audio Foley Engineering',
        slug: 'audio-foley',
        trackType: 'non_coding',
        cohortsCount: 0,
        enrolledStudentsCount: 0,
        status: 'draft',
        popularitySharePct: 0,
      },
    ]),
    getAdminExecutiveMetrics: vi.fn().mockResolvedValue({
      timeframe: '30d',
      enrollmentConversionRate: 85,
      courseCompletionRate: 70,
      overallChurnRatePct: 5,
      reviewAging: { lessThan12h: 4, between12and24h: 2, between24and48h: 1, over48h: 0 },
      dropoutRiskCount: 0,
      avgMentorReviewHours: 12,
      activeUsers7d: 40,
      activeUsers30d: 75,
      activeUsers90d: 90,
      cohortComparisons: [],
      atRiskLearners: [],
      cohortChurn: [],
      curriculumDropOff: [],
      mentorLeaderboard: [],
      escalationAlerts: [],
      courseDemand: [
        {
          courseId: 'c-web',
          title: 'Full Stack React & Node',
          slug: 'full-stack-react',
          trackType: 'coding',
          cohortsCount: 3,
          enrolledStudentsCount: 60,
          status: 'published',
          popularitySharePct: 67,
        },
        {
          courseId: 'c-video',
          title: 'Commercial Video Editing',
          slug: 'commercial-video',
          trackType: 'non_coding',
          cohortsCount: 2,
          enrolledStudentsCount: 30,
          status: 'published',
          popularitySharePct: 33,
        },
        {
          courseId: 'c-audio',
          title: 'Audio Foley Engineering',
          slug: 'audio-foley',
          trackType: 'non_coding',
          cohortsCount: 0,
          enrolledStudentsCount: 0,
          status: 'draft',
          popularitySharePct: 0,
        },
      ],
    }),
    listUsers: vi.fn().mockResolvedValue([]),
    listCohorts: vi.fn().mockResolvedValue([]),
    listCohortEnrollments: vi.fn().mockResolvedValue([]),
    listAnnouncements: vi.fn().mockResolvedValue([]),
    listLiveSessions: vi.fn().mockResolvedValue([]),
    listCommunityPostsWithAuthors: vi.fn().mockResolvedValue([]),
    listAdminCommunityReports: vi.fn().mockResolvedValue([]),
    listMentorCohortAssignments: vi.fn().mockResolvedValue([]),
  };
});

describe('Course Demand & Enrollment Distribution Visual Report UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCache.clear();
  });

  it('renders Course Demand section in Executive Insights tab with ranking and metrics', async () => {
    render(
      <MemoryRouter>
        <AdminOperations />
      </MemoryRouter>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Operations & Governance')).toBeInTheDocument();
    });

    // Click on Executive Insights tab
    const insightsTab = screen.getByRole('button', { name: /Executive Insights/i });
    fireEvent.click(insightsTab);

    // Verify Course Demand section header
    await waitFor(() => {
      expect(screen.getByText('Course Demand & Enrollment Distribution')).toBeInTheDocument();
    });

    // Check KPI summary cards
    expect(screen.getByText('Most Demanded Course')).toBeInTheDocument();
    expect(screen.getByText('Lowest Enrollment Course')).toBeInTheDocument();
    expect(screen.getByText('Total Active Enrollments')).toBeInTheDocument();
    expect(screen.getByText('Zero-Enrollment Courses')).toBeInTheDocument();

    // Verify most demanded course details (present in summary card and chart list)
    expect(screen.getAllByText('Full Stack React & Node').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/60/).length).toBeGreaterThanOrEqual(1);

    // Verify zero enrollment course details (present in summary card and chart list)
    expect(screen.getAllByText('Audio Foley Engineering').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/⚠️ Zero Enrollments/i)).toBeInTheDocument();

    // Verify horizontal bar meters
    const meters = screen.getAllByRole('meter');
    expect(meters.length).toBeGreaterThanOrEqual(3);
  });

  it('filters courses by track type (Coding vs Non-Coding)', async () => {
    render(
      <MemoryRouter>
        <AdminOperations />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Operations & Governance')).toBeInTheDocument();
    });

    // Switch to insights tab
    fireEvent.click(screen.getByRole('button', { name: /Executive Insights/i }));

    await waitFor(() => {
      expect(screen.getByText('Course Demand & Enrollment Distribution')).toBeInTheDocument();
    });

    // Initially both Coding and Non-Coding courses are displayed
    expect(screen.getAllByText('Full Stack React & Node').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Commercial Video Editing')).toBeInTheDocument();

    // Click Coding track filter
    const codingFilterBtn = screen.getByRole('button', { name: /^Coding$/i });
    fireEvent.click(codingFilterBtn);

    // Only Coding course should remain in the chart list
    expect(screen.getAllByText('Full Stack React & Node').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Commercial Video Editing')).not.toBeInTheDocument();

    // Click Non-Coding track filter
    const nonCodingFilterBtn = screen.getByRole('button', { name: /^Non-Coding$/i });
    fireEvent.click(nonCodingFilterBtn);

    // Coding course is not in list
    expect(screen.getByText('Commercial Video Editing')).toBeInTheDocument();
    expect(screen.getAllByText('Audio Foley Engineering').length).toBeGreaterThanOrEqual(1);
  });

  it('filters courses by search query', async () => {
    render(
      <MemoryRouter>
        <AdminOperations />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Operations & Governance')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Executive Insights/i }));

    await waitFor(() => {
      expect(screen.getByText('Course Demand & Enrollment Distribution')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search courses by title...');
    fireEvent.change(searchInput, { target: { value: 'Foley' } });

    // Only Foley course matches in the chart list
    expect(screen.getAllByText('Audio Foley Engineering').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Commercial Video Editing')).not.toBeInTheDocument();

    // Clear search
    const clearBtn = screen.getByRole('button', { name: /Clear search/i });
    fireEvent.click(clearBtn);

    expect(screen.getAllByText('Full Stack React & Node').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Commercial Video Editing')).toBeInTheDocument();
  });

  it('sorts courses by least demanded first (Low → High)', async () => {
    render(
      <MemoryRouter>
        <AdminOperations />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Operations & Governance')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Executive Insights/i }));

    await waitFor(() => {
      expect(screen.getByText('Course Demand & Enrollment Distribution')).toBeInTheDocument();
    });

    const sortSelect = screen.getByRole('combobox', { name: /Sort courses by demand/i });
    fireEvent.change(sortSelect, { target: { value: 'asc' } });

    // When sorted Low to High, Audio Foley Engineering (0 enrollments) is ranked #1
    const rankBadges = screen.getAllByText(/^#\d+$/);
    expect(rankBadges[0].textContent).toBe('#1');
  });

  it('toggles between Chart View and Enterprise Data Matrix mode', async () => {
    render(
      <MemoryRouter>
        <AdminOperations />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Operations & Governance')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Executive Insights/i }));

    await waitFor(() => {
      expect(screen.getByText('Course Demand & Enrollment Distribution')).toBeInTheDocument();
    });

    // Default is Chart View
    expect(screen.getByText('Scale Reference: 0 → 60 max learners')).toBeInTheDocument();

    // Switch to Data Matrix mode
    const matrixBtn = screen.getByRole('button', { name: /Data Matrix/i });
    fireEvent.click(matrixBtn);

    // Table columns should be rendered
    expect(screen.getByText('Master Course')).toBeInTheDocument();
    expect(screen.getByText('Catalog Share')).toBeInTheDocument();
    expect(screen.getByText('Intake Status')).toBeInTheDocument();

    // Verify course row in table
    expect(screen.getByText('ID: full-stack-react')).toBeInTheDocument();

    // Switch back to Chart View
    const chartBtn = screen.getByRole('button', { name: /Chart View/i });
    fireEvent.click(chartBtn);

    expect(screen.getByText('Scale Reference: 0 → 60 max learners')).toBeInTheDocument();
  });
});

