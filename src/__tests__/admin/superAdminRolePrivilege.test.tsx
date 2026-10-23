import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UsersTab } from '../../components/admin/tabs/UsersTab';
import type { UserProfile } from '../../lib/adminService';

describe('Role Hierarchy: Parent Super Admin, Child Super Admin, Admin, Mentor, Student', () => {
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

  const mockChildSuperAdmin: UserProfile = {
    id: 'admin-child',
    email: 'child@iunoware.com',
    full_name: 'Charlie ChildSuper',
    role: 'admin',
    admin_role: 'child_super_admin',
    status: 'active',
    created_at: new Date().toISOString(),
  };

  const mockParentSuperAdmin: UserProfile = {
    id: 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b',
    email: 'ajayramanan17@gmail.com',
    full_name: 'Ramanan',
    role: 'admin',
    admin_role: 'parent_super_admin',
    status: 'active',
    created_at: new Date().toISOString(),
  };

  const allUsers = [
    mockStudent,
    mockMentor,
    mockContentAdmin,
    mockChildSuperAdmin,
    mockParentSuperAdmin,
  ];

  it('renders distinguished "Parent Super Admin" and "Child Super Admin" badges', () => {
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockParentSuperAdmin.id}
        currentUserEmail={mockParentSuperAdmin.email}
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

    // Parent Super Admin badge
    const parentBadge = screen.getByTestId(`role-badge-${mockParentSuperAdmin.id}`);
    expect(parentBadge).toHaveTextContent('Parent Super Admin');

    // Child Super Admin badge
    const childBadge = screen.getByTestId(`role-badge-${mockChildSuperAdmin.id}`);
    expect(childBadge).toHaveTextContent('Child Super Admin');

    // Standard Content Admin badge
    const contentBadge = screen.getByTestId(`role-badge-${mockContentAdmin.id}`);
    expect(contentBadge).toHaveTextContent('Content Admin');
  });

  it('allows Parent Super Admin to see "Promote to Mentor", "Promote to Admin", and "Promote to Child Super Admin" on students', () => {
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockParentSuperAdmin.id}
        currentUserEmail={mockParentSuperAdmin.email}
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

    expect(screen.getByTestId(`promote-mentor-${mockStudent.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`promote-admin-${mockStudent.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`promote-child-super-${mockStudent.id}`)).toBeInTheDocument();
  });

  it('triggers onRoleChange with "child_super_admin" when Parent Super Admin clicks "Promote to Child Super Admin"', async () => {
    const handleRoleChange = vi.fn();
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockParentSuperAdmin.id}
        currentUserEmail={mockParentSuperAdmin.email}
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

    const promoteChildBtn = screen.getByTestId(`promote-child-super-${mockStudent.id}`);
    await act(async () => {
      fireEvent.click(promoteChildBtn);
    });

    expect(handleRoleChange).toHaveBeenCalledTimes(1);
    expect(handleRoleChange).toHaveBeenCalledWith(mockStudent, 'child_super_admin');
  });

  it('triggers onRoleChange with "admin" when Parent Super Admin clicks "Promote to Admin"', async () => {
    const handleRoleChange = vi.fn();
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockParentSuperAdmin.id}
        currentUserEmail={mockParentSuperAdmin.email}
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

  it('does NOT allow Child Super Admin or Content Admin to see role promotion buttons', () => {
    render(
      <UsersTab
        users={allUsers}
        currentUserId={mockChildSuperAdmin.id}
        currentUserEmail={mockChildSuperAdmin.email}
        canManageRoles={false}
        canManageStatus={true}
        isSuperAdmin={false}
        onRoleChange={vi.fn()}
        onStatusChange={vi.fn()}
        onAdminSubRoleChange={vi.fn()}
        onBulkUserStatus={vi.fn()}
        onExportUsers={vi.fn()}
        defaultRoleTab="student"
      />
    );

    expect(screen.queryByTestId(`promote-mentor-${mockStudent.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`promote-admin-${mockStudent.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`promote-child-super-${mockStudent.id}`)).not.toBeInTheDocument();
  });

  it('protects Ramanan (Parent Super Admin) from being demoted or modified in the UI', () => {
    render(
      <UsersTab
        users={allUsers}
        currentUserId="some-other-id"
        currentUserEmail="someone@iunoware.com"
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

    // Ramanan's row should NOT have demote buttons or subrole selector
    expect(screen.queryByTestId(`demote-mentor-${mockParentSuperAdmin.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`demote-student-${mockParentSuperAdmin.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`admin-subrole-select-${mockParentSuperAdmin.id}`)).not.toBeInTheDocument();
  });
});
