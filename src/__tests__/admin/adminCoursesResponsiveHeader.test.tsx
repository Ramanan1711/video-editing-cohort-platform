import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminCourses from '../../pages/AdminCourses';
import * as useAuthModule from '../../context/useAuth';
import type { Profile } from '../../context/authContextValue';
import * as courseService from '../../lib/courseService';

vi.mock('../../context/useAuth');
vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockAdminProfile = {
  id: 'admin-1',
  email: 'admin@example.com',
  full_name: 'Admin User',
  role: 'admin' as const,
  admin_role: 'parent_super_admin' as const,
  status: 'active' as const,
};

const mockMentorProfile: Profile = {
  id: 'mentor-1',
  email: 'mentor@example.com',
  full_name: 'Mentor User',
  role: 'mentor',
  status: 'active',
};

describe('AdminCourses Responsive Header (Mobile View Portrait, Tablet & Desktop)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(courseService, 'listCourses').mockResolvedValue([]);
    vi.spyOn(courseService, 'listCohorts').mockResolvedValue([]);
    vi.spyOn(courseService, 'listModules').mockResolvedValue([]);
    vi.spyOn(courseService, 'listAllAssignments').mockResolvedValue([]);
  });

  it('renders sticky header with mobile-safe padding, top-right controls, and action row for Admin', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com' } as any,
      profile: mockAdminProfile,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AdminCourses />
      </MemoryRouter>
    );

    // Wait for header to render
    expect(await screen.findByText('Admin studio')).toBeInTheDocument();
    expect(screen.getByText('Course Authoring')).toBeInTheDocument();

    // Verify header element exists and has sticky backdrop classes
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky');
    expect(header).toHaveClass('top-0');
    expect(header).toHaveClass('z-30');

    // Title container has mobile-safe hamburger clearance (pl-11 on mobile, lg:pl-0 on desktop)
    const titleBlock = screen.getByText('Course Authoring').closest('div');
    expect(titleBlock).toHaveClass('pl-11');
    expect(titleBlock).toHaveClass('lg:pl-0');

    // Verify Action buttons (Upload Challenge, New Cohort) are rendered with size="sm" and responsive layout
    const uploadChallengeBtn = screen.getByRole('button', { name: /Upload Challenge/i });
    expect(uploadChallengeBtn).toBeInTheDocument();
    expect(uploadChallengeBtn).toHaveClass('flex-1'); // Stretches cleanly on mobile
    expect(uploadChallengeBtn).toHaveClass('md:flex-initial');

    const newCohortBtn = screen.getByRole('button', { name: /New Cohort/i });
    expect(newCohortBtn).toBeInTheDocument();
    expect(newCohortBtn).toHaveClass('flex-1'); // Stretches cleanly on mobile
    expect(newCohortBtn).toHaveClass('md:flex-initial');

    // Verify TopRightControls are present in the header
    expect(screen.getByRole('button', { name: /Toggle dark mode/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sound effects/i })).toBeInTheDocument();
  });

  it('renders responsive header correctly for Mentor role', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'mentor-1', email: 'mentor@example.com' } as any,
      profile: mockMentorProfile,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AdminCourses />
      </MemoryRouter>
    );

    expect(await screen.findByText('Mentor studio')).toBeInTheDocument();
    expect(screen.getByText('Course & Curriculum Authoring')).toBeInTheDocument();

    // Role badge has hidden xl:inline-flex so it never clutters mobile portrait or tablet
    const roleBadge = screen.getByText('Course Author / Mentor');
    expect(roleBadge.parentElement).toHaveClass('hidden');
    expect(roleBadge.parentElement).toHaveClass('xl:inline-flex');

    // Verify TopRightControls
    expect(screen.getByRole('button', { name: /Toggle dark mode/i })).toBeInTheDocument();
  });
});
