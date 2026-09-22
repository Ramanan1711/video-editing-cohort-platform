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

  it('super_admin holds all administrative privileges in the platform', () => {
    allPermissions.forEach((permission) => {
      expect(hasAdminPermission('super_admin', permission)).toBe(true);
    });
  });

  it('defaults to super_admin privileges when admin_role is unspecified or null', () => {
    allPermissions.forEach((permission) => {
      expect(hasAdminPermission(undefined, permission)).toBe(true);
      expect(hasAdminPermission(null, permission)).toBe(true);
    });
  });

  it('content_admin can manage curriculum and publish content, but cannot manage roles, status, or enrollments', () => {
    const role: AdminSubRole = 'content_admin';
    expect(hasAdminPermission(role, 'manage_curriculum')).toBe(true);
    expect(hasAdminPermission(role, 'publish_content')).toBe(true);
    expect(hasAdminPermission(role, 'manage_cohorts')).toBe(true);
    expect(hasAdminPermission(role, 'view_insights')).toBe(true);

    expect(hasAdminPermission(role, 'manage_roles')).toBe(false);
    expect(hasAdminPermission(role, 'manage_user_status')).toBe(false);
    expect(hasAdminPermission(role, 'manage_enrollments')).toBe(false);
    expect(hasAdminPermission(role, 'moderate_community')).toBe(false);
    expect(hasAdminPermission(role, 'view_audit_logs')).toBe(false);
  });

  it('operations_admin can manage enrollments and sessions, but cannot alter roles, curriculum, or audit logs', () => {
    const role: AdminSubRole = 'operations_admin';
    expect(hasAdminPermission(role, 'manage_enrollments')).toBe(true);
    expect(hasAdminPermission(role, 'manage_cohorts')).toBe(true);
    expect(hasAdminPermission(role, 'schedule_sessions')).toBe(true);
    expect(hasAdminPermission(role, 'broadcast_announcements')).toBe(true);
    expect(hasAdminPermission(role, 'view_insights')).toBe(true);

    expect(hasAdminPermission(role, 'manage_roles')).toBe(false);
    expect(hasAdminPermission(role, 'manage_user_status')).toBe(false);
    expect(hasAdminPermission(role, 'manage_curriculum')).toBe(false);
    expect(hasAdminPermission(role, 'publish_content')).toBe(false);
    expect(hasAdminPermission(role, 'view_audit_logs')).toBe(false);
  });

  it('moderator can moderate community discussions and broadcast announcements, but cannot manage infrastructure or security', () => {
    const role: AdminSubRole = 'moderator';
    expect(hasAdminPermission(role, 'moderate_community')).toBe(true);
    expect(hasAdminPermission(role, 'broadcast_announcements')).toBe(true);
    expect(hasAdminPermission(role, 'view_insights')).toBe(true);

    expect(hasAdminPermission(role, 'manage_roles')).toBe(false);
    expect(hasAdminPermission(role, 'manage_user_status')).toBe(false);
    expect(hasAdminPermission(role, 'manage_cohorts')).toBe(false);
    expect(hasAdminPermission(role, 'manage_curriculum')).toBe(false);
    expect(hasAdminPermission(role, 'manage_enrollments')).toBe(false);
    expect(hasAdminPermission(role, 'view_audit_logs')).toBe(false);
  });

  it('provides human-readable labels and descriptions for all administrative sub-roles', () => {
    const subRoles: AdminSubRole[] = ['super_admin', 'content_admin', 'operations_admin', 'moderator'];
    subRoles.forEach((r) => {
      expect(ROLE_LABELS[r]).toBeDefined();
      expect(ROLE_DESCRIPTIONS[r]).toBeDefined();
      expect(ROLE_PERMISSIONS[r].length).toBeGreaterThan(0);
    });
  });
});
