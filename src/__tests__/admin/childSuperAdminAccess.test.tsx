import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminOperations } from '../../pages/AdminOperations';
import * as useAuthModule from '../../context/useAuth';

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

// Mock Admin Services
vi.mock('../../lib/adminService', async () => {
  const actual = await vi.importActual('../../lib/adminService');
  return {
    ...actual,
    getAdminStats: vi.fn().mockResolvedValue({
      users: 50,
      students: 40,
      mentors: 8,
      admins: 2,
      cohorts: 4,
      enrollments: 35,
      posts: 10,
      pendingSubmissions: 2,
      reviewedSubmissions: 18,
      activeChallenges: 3,
    }),
    listUsers: vi.fn().mockResolvedValue([
      {
        id: 'student-1',
        email: 'alice@example.com',
        full_name: 'Alice Student',
        role: 'student',
        status: 'active',
        created_at: new Date().toISOString(),
      },
    ]),
    listCohortsWithDemand: vi.fn().mockResolvedValue([]),
    listEnrollments: vi.fn().mockResolvedValue([]),
    listMentorAssignments: vi.fn().mockResolvedValue([]),
    listAnnouncements: vi.fn().mockResolvedValue([]),
    listLiveSessions: vi.fn().mockResolvedValue([]),
    listAuditLogs: vi.fn().mockResolvedValue([]),
    listAdvertisements: vi.fn().mockResolvedValue([]),
    getRecentActivity: vi.fn().mockResolvedValue([]),
    getDropoutRiskStudents: vi.fn().mockResolvedValue([]),
    getObservabilityAlerts: vi.fn().mockResolvedValue([]),
  };
});

// Mock Notification Service
vi.mock('../../lib/notificationService', () => ({
  listUserNotifications: vi.fn().mockResolvedValue([]),
  markNotificationAsRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsAsRead: vi.fn().mockResolvedValue(undefined),
}));

describe('AdminConsole - Child Super Admin Privileges & Restrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows Child Super Admin to access Users & Roles tab without permission denial', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'child-admin-1', email: 'childadmin@example.com' } as any,
      profile: {
        id: 'child-admin-1',
        full_name: 'Child Super Admin',
        role: 'admin',
        admin_role: 'child_super_admin',
      } as any,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AdminOperations />
      </MemoryRouter>
    );

    // Verify Users & Roles button is enabled and not locked
    const usersTabBtn = await screen.findByRole('button', { name: /Users & Roles/i });
    expect(usersTabBtn).toBeInTheDocument();
    expect(usersTabBtn).not.toHaveClass('cursor-not-allowed');

    // Click Users & Roles
    fireEvent.click(usersTabBtn);

    // Verify Users & Roles content loads
    await waitFor(() => {
      expect(screen.getByText('Alice Student')).toBeInTheDocument();
      expect(screen.getByTestId('user-role-tab-student')).toBeInTheDocument();
    });

    // The restriction: Child Super Admin must NOT see "Register Staff"
    expect(screen.queryByText(/Register Staff/i)).not.toBeInTheDocument();
  });

  it('shows Register Staff link strictly to Parent Super Admin', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'parent-admin-1', email: 'ajayramanan17@gmail.com' } as any,
      profile: {
        id: 'parent-admin-1',
        full_name: 'Parent Super Admin',
        email: 'ajayramanan17@gmail.com',
        role: 'admin',
        admin_role: 'parent_super_admin',
      } as any,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AdminOperations />
      </MemoryRouter>
    );

    // Parent Super Admin sees Register Staff in header
    const registerStaffLink = await screen.findByRole('link', { name: /Register Staff/i });
    expect(registerStaffLink).toBeInTheDocument();
    expect(registerStaffLink).toHaveAttribute('href', '/admin/super-admin');

    // Parent Super Admin can also click Users & Roles
    const usersTabBtn = screen.getByRole('button', { name: /Users & Roles/i });
    fireEvent.click(usersTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Alice Student')).toBeInTheDocument();
    });
  });
});

