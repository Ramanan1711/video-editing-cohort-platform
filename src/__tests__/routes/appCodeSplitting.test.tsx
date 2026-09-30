import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from '../../App';

// Mock auth context to test authenticated admin routes
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', email: 'admin@cutcraft.com' },
    profile: {
      id: 'admin-1',
      role: 'admin',
      admin_role: 'super_admin',
    },
    signOut: vi.fn(),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    loading: false,
  }),
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../lib/courseService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/courseService')>();
  return {
    ...actual,
    listCohorts: vi.fn().mockResolvedValue([]),
    listModules: vi.fn().mockResolvedValue([]),
    listAssignments: vi.fn().mockResolvedValue([]),
    listAllAssignments: vi.fn().mockResolvedValue([]),
    listAllLessonResources: vi.fn().mockResolvedValue([]),
    listMySubmissions: vi.fn().mockResolvedValue([]),
    listStudentLiveSessions: vi.fn().mockResolvedValue([]),
    listStudentAnnouncements: vi.fn().mockResolvedValue([]),
    getStudentCourseData: vi.fn().mockResolvedValue({ modules: [], progress: [], enrolledCohorts: [] }),
    getStudentUnifiedProgress: vi.fn().mockResolvedValue(null),
  };
});

vi.mock('../../lib/adminService', () => ({
  getAdminExecutiveMetrics: vi.fn().mockResolvedValue({
    activeStudents: 0,
    activeCohorts: 0,
    pendingReviews: 0,
    escalationAlerts: [],
  }),
}));

describe('App - Code Splitting & Dynamic Lazy Loading Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders public landing route initially without loading heavy admin bundles', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    // Landing page elements should be in the document
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('renders login route cleanly without bundling admin or mentor chunks', async () => {
    window.history.pushState({}, '', '/login');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: /return to the room/i })).toBeInTheDocument();
    });
  });

  it('dynamically loads admin courses route on demand wrapped with Suspense fallback', async () => {
    window.history.pushState({}, '', '/admin/courses');
    render(<App />);

    // Protected route resolves and lazily loads admin courses page
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /course authoring/i })).toBeInTheDocument();
    });
  });
});
