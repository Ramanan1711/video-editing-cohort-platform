import { describe, it, expect } from 'vitest';
import {
  hasAdminPermission,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
} from '../../lib/adminPermissions';
import type { AdminSubRole, AdminPermission } from '../../lib/adminPermissions';

describe('Admin Permissions & RBAC Matrix', () => {
  const allPermissions: AdminPermission[] = [
    'manage_roles',
    'manage_user_status',
    'manage_cohorts',
    'manage_curriculum',
    'publish_content',
    'manage_enrollments',
    'broadcast_announcements',
    'schedule_sessions',
    'moderate_community',
    'view_audit_logs',
    'view_insights',
  ];

  it('parent_super_admin holds all administrative privileges in the platform', () => {
    allPermissions.forEach((permission) => {
      expect(hasAdminPermission('parent_super_admin', permission)).toBe(true);
      expect(hasAdminPermission('super_admin', permission)).toBe(true);
    });
  });

  it('child_super_admin holds operational privileges, but cannot manage roles', () => {
    const role: AdminSubRole = 'child_super_admin';
    expect(hasAdminPermission(role, 'manage_roles')).toBe(false);

    expect(hasAdminPermission(role, 'manage_user_status')).toBe(true);
    expect(hasAdminPermission(role, 'manage_cohorts')).toBe(true);
    expect(hasAdminPermission(role, 'manage_curriculum')).toBe(true);
    expect(hasAdminPermission(role, 'publish_content')).toBe(true);
    expect(hasAdminPermission(role, 'manage_enrollments')).toBe(true);
    expect(hasAdminPermission(role, 'broadcast_announcements')).toBe(true);
    expect(hasAdminPermission(role, 'schedule_sessions')).toBe(true);
    expect(hasAdminPermission(role, 'moderate_community')).toBe(true);
    expect(hasAdminPermission(role, 'view_audit_logs')).toBe(true);
    expect(hasAdminPermission(role, 'view_insights')).toBe(true);
  });

  it('admin_role fallback resolves permissions for child_super_admin', () => {
    expect(hasAdminPermission('child_super_admin', 'manage_cohorts')).toBe(true);
    expect(hasAdminPermission('child_super_admin', 'manage_curriculum')).toBe(true);
    expect(hasAdminPermission('child_super_admin', 'publish_content')).toBe(true);
    expect(hasAdminPermission('child_super_admin', 'manage_enrollments')).toBe(true);
    expect(hasAdminPermission('child_super_admin', 'broadcast_announcements')).toBe(true);
    expect(hasAdminPermission('child_super_admin', 'schedule_sessions')).toBe(true);
    expect(hasAdminPermission('child_super_admin', 'moderate_community')).toBe(true);
    expect(hasAdminPermission('child_super_admin', 'view_insights')).toBe(true);
    expect(hasAdminPermission('child_super_admin', 'view_audit_logs')).toBe(true);
    expect(hasAdminPermission('child_super_admin', 'manage_user_status')).toBe(true);

    expect(hasAdminPermission('child_super_admin', 'manage_roles')).toBe(false);
  });

  it('provides human-readable labels and descriptions for administrative sub-roles', () => {
    const subRoles: AdminSubRole[] = ['parent_super_admin', 'child_super_admin', 'super_admin'];
    subRoles.forEach((r) => {
      expect(ROLE_LABELS[r]).toBeDefined();
      expect(ROLE_DESCRIPTIONS[r]).toBeDefined();
      expect(ROLE_PERMISSIONS[r].length).toBeGreaterThan(0);
    });
  });
});
