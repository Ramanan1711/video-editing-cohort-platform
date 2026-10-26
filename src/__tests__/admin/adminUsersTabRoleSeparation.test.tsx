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
      admin_role: 'child_super_admin',
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

  it('renders only the Students sub-tab with accurate student count', () => {
    render(<UsersTab {...defaultProps} />);

    // Verify Students sub-tab exists
    const studentTab = screen.getByTestId('user-role-tab-student');
    expect(studentTab).toBeInTheDocument();
    expect(studentTab).toHaveTextContent('Students');
    expect(studentTab).toHaveTextContent('2');

    // Verify Mentor, Admin, and All Users sub-tabs are NOT present
    expect(screen.queryByTestId('user-role-tab-mentor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-role-tab-admin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-role-tab-all')).not.toBeInTheDocument();
  });

  it('displays only Students in the User Directory view', () => {
    render(<UsersTab {...defaultProps} />);

    // Students must be visible
    expect(screen.getByText('Alice Student')).toBeInTheDocument();
    expect(screen.getByText('Bob Student')).toBeInTheDocument();

    // Mentors and Admins must NOT be in the students directory
    expect(screen.queryByText('Charlie Mentor')).not.toBeInTheDocument();
    expect(screen.queryByText('Diana Admin')).not.toBeInTheDocument();
  });

  it('shows friendly empty state when no students match search', () => {
    render(<UsersTab {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });

    expect(screen.getByText('No students found.')).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your search criteria/i)).toBeInTheDocument();
  });
});

