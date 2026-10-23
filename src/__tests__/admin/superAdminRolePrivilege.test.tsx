import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UsersTab } from '../../components/admin/tabs/UsersTab';
import type { UserProfile } from '../../lib/adminService';

describe('Super Admin Role & Promotion Privilege', () => {
  const mockStudent: UserProfile = {
    id: 'student-1',
    email: 'student@iunoware.com',
    full_name: 'Sam Student',
    role: 'student',
    status: 'active',
    created_at: new Date().toISOString(),
  };

  const mockMentor: UserProfile = {
    id: 'mentor-1',
    email: 'mentor@iunoware.com',
    full_name: 'Morgan Mentor',
    role: 'mentor',
    status: 'active',
    created_at: new Date().toISOString(),
  };

  const mockContentAdmin: UserProfile = {
    id: 'admin-content',
    email: 'content@iunoware.com',
    full_name: 'Casey Content',
    role: 'admin',
    admin_role: 'content_admin',
    status: 'active',
    created_at: new Date().toISOString(),
  };

  const mockSuperAdmin: UserProfile = {
    id: 'admin-super',
    email: 'super@iunoware.com',
    full_name: 'Sovereign SuperAdmin',
    role: 'admin',
    admin_role: 'super_admin',
    status: 'active',
    created_at: new Date().toISOString(),
  };

  const allUsers = [mockStudent, mockMentor, mockContentAdmin, mockSuperAdmin];

  it('renders distinguished "Super Admin" badge for super_admin users', () => {
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockSuperAdmin.id}
        canManageRoles={true}
        canManageStatus={true}
        isSuperAdmin={true}
        onRoleChange={vi.fn()}
        onStatusChange={vi.fn()}
        onAdminSubRoleChange={vi.fn()}
        onBulkUserStatus={vi.fn()}
        onExportUsers={vi.fn()}
        defaultRoleTab="admin"
      />
    );

    // Should find the "Super Admin" badge text
    const superBadge = screen.getByTestId(`role-badge-${mockSuperAdmin.id}`);
    expect(superBadge).toHaveTextContent('Super Admin');

    // And also Content Admin badge
    const contentBadge = screen.getByTestId(`role-badge-${mockContentAdmin.id}`);
    expect(contentBadge).toHaveTextContent('Content Admin');
  });

  it('allows Super Admin to see "Promote to Admin" for students and mentors', () => {
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockSuperAdmin.id}
        canManageRoles={true}
        canManageStatus={true}
        isSuperAdmin={true}
        onRoleChange={vi.fn()}
        onStatusChange={vi.fn()}
        onAdminSubRoleChange={vi.fn()}
        onBulkUserStatus={vi.fn()}
        onExportUsers={vi.fn()}
        defaultRoleTab="student"
      />
    );

    // Promote to Admin button should exist for student
    const promoteBtn = screen.getByTestId(`promote-admin-${mockStudent.id}`);
    expect(promoteBtn).toBeInTheDocument();
    expect(promoteBtn).toHaveTextContent('Promote to Admin');
  });

  it('triggers onRoleChange with "admin" when Super Admin clicks "Promote to Admin" on a student', async () => {
    const handleRoleChange = vi.fn();
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockSuperAdmin.id}
        canManageRoles={true}
        canManageStatus={true}
        isSuperAdmin={true}
        onRoleChange={handleRoleChange}
        onStatusChange={vi.fn()}
        onAdminSubRoleChange={vi.fn()}
        onBulkUserStatus={vi.fn()}
        onExportUsers={vi.fn()}
        defaultRoleTab="student"
      />
    );

    const promoteBtn = screen.getByTestId(`promote-admin-${mockStudent.id}`);
    await act(async () => {
      fireEvent.click(promoteBtn);
    });

    expect(handleRoleChange).toHaveBeenCalledTimes(1);
    expect(handleRoleChange).toHaveBeenCalledWith(mockStudent, 'admin');
  });

  it('triggers onRoleChange with "admin" when Super Admin clicks "Promote to Admin" on a mentor', async () => {
    const handleRoleChange = vi.fn();
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockSuperAdmin.id}
        canManageRoles={true}
        canManageStatus={true}
        isSuperAdmin={true}
        onRoleChange={handleRoleChange}
        onStatusChange={vi.fn()}
        onAdminSubRoleChange={vi.fn()}
        onBulkUserStatus={vi.fn()}
        onExportUsers={vi.fn()}
        defaultRoleTab="mentor"
      />
    );

    const promoteBtn = screen.getByTestId(`promote-admin-${mockMentor.id}`);
    expect(promoteBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(promoteBtn);
    });

    expect(handleRoleChange).toHaveBeenCalledTimes(1);
    expect(handleRoleChange).toHaveBeenCalledWith(mockMentor, 'admin');
  });

  it('does NOT render "Promote to Admin" when isSuperAdmin is false (e.g. content_admin/moderator)', () => {
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockContentAdmin.id}
        canManageRoles={false}
        canManageStatus={false}
        isSuperAdmin={false}
        onRoleChange={vi.fn()}
        onStatusChange={vi.fn()}
        onAdminSubRoleChange={vi.fn()}
        onBulkUserStatus={vi.fn()}
        onExportUsers={vi.fn()}
        defaultRoleTab="student"
      />
    );

    // No Promote to Admin button should be present
    expect(screen.queryByTestId(`promote-admin-${mockStudent.id}`)).not.toBeInTheDocument();
    expect(screen.queryByText('Promote to Admin')).not.toBeInTheDocument();
  });

  it('allows Super Admin to demote other admins to mentor', async () => {
    const handleRoleChange = vi.fn();
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockSuperAdmin.id}
        canManageRoles={true}
        canManageStatus={true}
        isSuperAdmin={true}
        onRoleChange={handleRoleChange}
        onStatusChange={vi.fn()}
        onAdminSubRoleChange={vi.fn()}
        onBulkUserStatus={vi.fn()}
        onExportUsers={vi.fn()}
        defaultRoleTab="admin"
      />
    );

    // Content admin is not self, so demote button should be available
    const demoteBtn = screen.getByTestId(`demote-mentor-${mockContentAdmin.id}`);
    expect(demoteBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(demoteBtn);
    });
    expect(handleRoleChange).toHaveBeenCalledWith(mockContentAdmin, 'mentor');
  });

  it('never displays promotion or demotion buttons for the current user themselves', () => {
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockSuperAdmin.id}
        canManageRoles={true}
        canManageStatus={true}
        isSuperAdmin={true}
        onRoleChange={vi.fn()}
        onStatusChange={vi.fn()}
        onAdminSubRoleChange={vi.fn()}
        onBulkUserStatus={vi.fn()}
        onExportUsers={vi.fn()}
        defaultRoleTab="admin"
      />
    );

    // Current user row has "You" badge and no demote button
    expect(screen.queryByTestId(`demote-mentor-${mockSuperAdmin.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`promote-admin-${mockSuperAdmin.id}`)).not.toBeInTheDocument();
  });
});
