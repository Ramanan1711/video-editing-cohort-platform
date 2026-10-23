import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UsersTab } from '../../components/admin/tabs/UsersTab';
import type { UserProfile } from '../../lib/adminService';

describe('Admin Console - Users & Roles Tab Role Separation', () => {
  const mockUsers: UserProfile[] = [
    {
      id: 'student-1',
      email: 'student1@iunoware.com',
      full_name: 'Alice Student',
      role: 'student',
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: 'student-2',
      email: 'student2@iunoware.com',
      full_name: 'Bob Student',
      role: 'student',
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: 'mentor-1',
      email: 'mentor1@iunoware.com',
      full_name: 'Charlie Mentor',
      role: 'mentor',
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: 'admin-1',
      email: 'admin1@iunoware.com',
      full_name: 'Diana Admin',
      role: 'admin',
      admin_role: 'super_admin',
      status: 'active',
      created_at: new Date().toISOString(),
    },
  ];

  const defaultProps = {
    users: mockUsers,
    currentUserId: 'admin-1',
    canManageRoles: true,
    canManageStatus: true,
    onRoleChange: vi.fn(),
    onStatusChange: vi.fn(),
    onAdminSubRoleChange: vi.fn(),
    onBulkUserStatus: vi.fn(),
    onExportUsers: vi.fn(),
  };

  it('renders separate sub-tabs for Students, Mentors, and Admins with accurate counts', () => {
    render(<UsersTab {...defaultProps} />);

    // Verify sub-tabs exist
    const studentTab = screen.getByTestId('user-role-tab-student');
    const mentorTab = screen.getByTestId('user-role-tab-mentor');
    const adminTab = screen.getByTestId('user-role-tab-admin');
    const allTab = screen.getByTestId('user-role-tab-all');

    expect(studentTab).toBeInTheDocument();
    expect(mentorTab).toBeInTheDocument();
    expect(adminTab).toBeInTheDocument();
    expect(allTab).toBeInTheDocument();

    // Verify counts in tab badges
    expect(studentTab).toHaveTextContent('Students');
    expect(studentTab).toHaveTextContent('2');

    expect(mentorTab).toHaveTextContent('Mentors');
    expect(mentorTab).toHaveTextContent('1');

    expect(adminTab).toHaveTextContent('Admins');
    expect(adminTab).toHaveTextContent('1');

    expect(allTab).toHaveTextContent('All Users');
    expect(allTab).toHaveTextContent('4');
  });

  it('defaults to displaying only Students on initial view', () => {
    render(<UsersTab {...defaultProps} />);

    // Students must be visible
    expect(screen.getByText('Alice Student')).toBeInTheDocument();
    expect(screen.getByText('Bob Student')).toBeInTheDocument();

    // Mentors and Admins must NOT be in the student view
    expect(screen.queryByText('Charlie Mentor')).not.toBeInTheDocument();
    expect(screen.queryByText('Diana Admin')).not.toBeInTheDocument();
  });

  it('switches to displaying only Mentors when clicking the Mentors tab', () => {
    render(<UsersTab {...defaultProps} />);

    const mentorTab = screen.getByTestId('user-role-tab-mentor');
    fireEvent.click(mentorTab);

    // Mentor must be visible
    expect(screen.getByText('Charlie Mentor')).toBeInTheDocument();

    // Students and Admins must NOT be visible
    expect(screen.queryByText('Alice Student')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Student')).not.toBeInTheDocument();
    expect(screen.queryByText('Diana Admin')).not.toBeInTheDocument();
  });

  it('switches to displaying only Admins when clicking the Admins tab', () => {
    render(<UsersTab {...defaultProps} />);

    const adminTab = screen.getByTestId('user-role-tab-admin');
    fireEvent.click(adminTab);

    // Admin must be visible
    expect(screen.getByText('Diana Admin')).toBeInTheDocument();

    // Students and Mentors must NOT be visible
    expect(screen.queryByText('Alice Student')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Student')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Mentor')).not.toBeInTheDocument();
  });

  it('displays all users when clicking the All Users tab', () => {
    render(<UsersTab {...defaultProps} />);

    const allTab = screen.getByTestId('user-role-tab-all');
    fireEvent.click(allTab);

    // All users must be visible
    expect(screen.getByText('Alice Student')).toBeInTheDocument();
    expect(screen.getByText('Bob Student')).toBeInTheDocument();
    expect(screen.getByText('Charlie Mentor')).toBeInTheDocument();
    expect(screen.getByText('Diana Admin')).toBeInTheDocument();
  });

  it('shows friendly empty state when a tab has no users matching search', () => {
    render(<UsersTab {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });

    expect(screen.getByText('No students found.')).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your search criteria/i)).toBeInTheDocument();
  });
});

