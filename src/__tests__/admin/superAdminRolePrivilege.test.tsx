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

  it('does NOT show any promotion buttons (Promote to Mentor, Admin, or Child Super Admin) for students', () => {
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

    expect(screen.queryByTestId(`promote-mentor-${mockStudent.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`promote-admin-${mockStudent.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`promote-child-super-${mockStudent.id}`)).not.toBeInTheDocument();
    expect(screen.queryByText('Promote to Mentor')).not.toBeInTheDocument();
    expect(screen.queryByText('Promote to Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Promote to Child Super Admin')).not.toBeInTheDocument();
  });

  it('does NOT show any action buttons (Demote to Student, Promote to Admin, or Promote to Child Super Admin) for mentors', () => {
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
        defaultRoleTab="mentor"
      />
    );

    expect(screen.queryByTestId(`demote-student-${mockMentor.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`promote-admin-${mockMentor.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`promote-child-super-${mockMentor.id}`)).not.toBeInTheDocument();
    expect(screen.queryByText('Demote to Student')).not.toBeInTheDocument();
    expect(screen.queryByText('Promote to Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Promote to Child Super Admin')).not.toBeInTheDocument();
  });

  it('allows Parent Super Admin to change Admin sub-role via selector in admin view', async () => {
    const handleAdminSubRoleChange = vi.fn();
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
        onAdminSubRoleChange={handleAdminSubRoleChange}
        onBulkUserStatus={vi.fn()}
        onExportUsers={vi.fn()}
        defaultRoleTab="admin"
      />
    );

    const subroleSelect = screen.getByTestId(`admin-subrole-select-${mockContentAdmin.id}`);
    expect(subroleSelect).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(subroleSelect, { target: { value: 'child_super_admin' } });
    });

    expect(handleAdminSubRoleChange).toHaveBeenCalledTimes(1);
    expect(handleAdminSubRoleChange).toHaveBeenCalledWith(mockContentAdmin, 'child_super_admin');
  });

  it('allows Parent Super Admin to demote Admin to Mentor or Student', async () => {
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
        defaultRoleTab="admin"
      />
    );

    const demoteMentorBtn = screen.getByTestId(`demote-mentor-${mockContentAdmin.id}`);
    expect(demoteMentorBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(demoteMentorBtn);
    });

    expect(handleRoleChange).toHaveBeenCalledTimes(1);
    expect(handleRoleChange).toHaveBeenCalledWith(mockContentAdmin, 'mentor');
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
