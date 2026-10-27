import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import * as useAuthModule from '../../context/useAuth';
import * as studentAccessService from '../../lib/studentAccessService';

vi.mock('../../context/useAuth');

describe('ProtectedRoute Component', () => {
  const mockSignOut = vi.fn();
  const mockRefreshProfile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading spinner while authentication state is loading', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      loading: true,
      signOut: mockSignOut,
      refreshProfile: mockRefreshProfile,
      login: vi.fn(),
      signup: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated/logged-out user to /login', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: mockSignOut,
      refreshProfile: mockRefreshProfile,
      login: vi.fn(),
      signup: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Protected Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Dashboard')).not.toBeInTheDocument();
  });

  it('renders suspended account lock screen when profile is suspended', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'user-suspended-1', email: 'suspended@cutcraft.test' },
      profile: { id: 'user-suspended-1', email: 'suspended@cutcraft.test', role: 'student', status: 'suspended' },
      loading: false,
      signOut: mockSignOut,
      refreshProfile: mockRefreshProfile,
      login: vi.fn(),
      signup: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Account Access Suspended')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();

    const signOutBtn = screen.getByRole('button', { name: /Sign Out of Platform/i });
    fireEvent.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('renders inactive account lock screen when profile is inactive', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'user-inactive-1', email: 'inactive@cutcraft.test' },
      profile: { id: 'user-inactive-1', email: 'inactive@cutcraft.test', role: 'student', status: 'inactive' },
      loading: false,
      signOut: mockSignOut,
      refreshProfile: mockRefreshProfile,
      login: vi.fn(),
      signup: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Account Inactive')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();

    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    fireEvent.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('redirects to /unauthorized when user role is not allowed', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'user-student-1', email: 'student@cutcraft.test' },
      profile: { id: 'user-student-1', email: 'student@cutcraft.test', role: 'student', status: 'active' },
      loading: false,
      signOut: mockSignOut,
      refreshProfile: mockRefreshProfile,
      login: vi.fn(),
      signup: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);

    render(
      <MemoryRouter initialEntries={['/admin/operations']}>
        <Routes>
          <Route
            path="/admin/operations"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <div>Admin Operations Control Room</div>
              </ProtectedRoute>
            }
          />
          <Route path="/unauthorized" element={<div>Access Denied (403)</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Access Denied (403)')).toBeInTheDocument();
    expect(screen.queryByText('Admin Operations Control Room')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated with active status and permitted role', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'user-admin-1', email: 'admin@cutcraft.test' },
      profile: { id: 'user-admin-1', email: 'admin@cutcraft.test', role: 'admin', status: 'active' },
      loading: false,
      signOut: mockSignOut,
      refreshProfile: mockRefreshProfile,
      login: vi.fn(),
      signup: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);

    render(
      <MemoryRouter initialEntries={['/admin/operations']}>
        <ProtectedRoute allowedRoles={['admin']}>
          <div>Admin Operations Control Room</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Operations Control Room')).toBeInTheDocument();
  });

  it('renders Course Access Expired screen when student enrolled course duration (end date + 60 days) has ended', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'user-student-expired', email: 'expired@cutcraft.test' },
      profile: { id: 'user-student-expired', email: 'expired@cutcraft.test', role: 'student', status: 'active' },
      loading: false,
      signOut: mockSignOut,
      refreshProfile: mockRefreshProfile,
      login: vi.fn(),
      signup: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);

    vi.spyOn(studentAccessService, 'checkStudentLoginAccess').mockResolvedValue({
      hasAccess: false,
      isEnrolled: true,
      courseEndDate: '2026-11-15T00:00:00.000Z',
      accessExpiryDate: '2027-01-14T00:00:00.000Z',
      formattedCourseEndDate: '15 Nov 2026',
      formattedAccessExpiryDate: '14 Jan 2027',
      message: 'Your enrolled course access duration ended on 14 Jan 2027 (60 days after your course ended on 15 Nov 2026).',
    });

    render(
      <MemoryRouter initialEntries={['/student/dashboard']}>
        <ProtectedRoute allowedRoles={['student']}>
          <div>Student Workspace</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(await screen.findByText('Course Access Expired')).toBeInTheDocument();
    expect(screen.getAllByText(/14 Jan 2027/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/15 Nov 2026/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Student Workspace')).not.toBeInTheDocument();

    const signOutBtn = screen.getByRole('button', { name: /Sign Out of Platform/i });
    fireEvent.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
