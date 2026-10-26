// src/lib/adminPermissions.ts
// Granular Role-Based Access Control (RBAC) Matrix for Administration
// Strictly two admin_roles: 'parent_super_admin' and 'child_super_admin' ('super_admin' alias for parent_super_admin).
// Standard administrators have role = 'admin' with admin_role = null.

export type AdminSubRole =
  | 'parent_super_admin'
  | 'child_super_admin'
  | 'super_admin';

export type AdminPermission =
  | 'manage_roles' // promote/demote users, change admin sub-roles (Parent Super Admin only)
  | 'manage_user_status' // suspend/reactivate users
  | 'manage_cohorts' // create/edit/delete cohorts
  | 'manage_curriculum' // modules, lessons, assignments, resources
  | 'publish_content' // publish/unpublish/archive courses and lessons
  | 'manage_enrollments' // enroll/drop students, bulk import
  | 'broadcast_announcements' // broadcast announcements
  | 'schedule_sessions' // create/edit live sessions
  | 'moderate_community' // delete posts/comments, review reports
  | 'view_audit_logs' // view security audit trail & export CSV
  | 'view_insights'; // view executive insights and dropout risks

export const STANDARD_ADMIN_PERMISSIONS: AdminPermission[] = [
  'manage_cohorts',
  'manage_curriculum',
  'publish_content',
  'manage_enrollments',
  'broadcast_announcements',
  'schedule_sessions',
  'moderate_community',
  'view_insights',
];

export const ROLE_PERMISSIONS: Record<AdminSubRole, AdminPermission[]> = {
  parent_super_admin: [
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
  ],
  super_admin: [
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
  ],
  child_super_admin: [
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
  ],
};

export const ROLE_LABELS: Record<AdminSubRole, string> = {
  parent_super_admin: 'Parent Super Admin',
  child_super_admin: 'Child Super Admin',
  super_admin: 'Parent Super Admin',
};

export const ROLE_DESCRIPTIONS: Record<AdminSubRole, string> = {
  parent_super_admin: 'Root platform sovereignty: exclusive authority to appoint Mentors, Admins, and Child Super Admins.',
  super_admin: 'Root platform sovereignty: exclusive authority to appoint Mentors, Admins, and Child Super Admins.',
  child_super_admin: 'Executive platform administrator with all operational, content, and student management capabilities.',
};

/**
 * Checks whether an admin user holds a specific administrative privilege.
 * If adminRole is null/undefined (standard admin), returns STANDARD_ADMIN_PERMISSIONS.
 */
export function hasAdminPermission(
  adminRole: AdminSubRole | string | undefined | null,
  permission: AdminPermission
): boolean {
  if (!adminRole) {
    return STANDARD_ADMIN_PERMISSIONS.includes(permission);
  }
  const role = adminRole as AdminSubRole;
  const permissions = ROLE_PERMISSIONS[role];
  return Boolean(permissions ? permissions.includes(permission) : STANDARD_ADMIN_PERMISSIONS.includes(permission));
}

/**
 * Checks whether a user is the root Parent Super Admin.
 * Recognized by admin_role = 'parent_super_admin' | 'super_admin' or email ajayramanan17@gmail.com
 */
export function isParentSuperAdmin(
  user?: { role?: string; admin_role?: string; email?: string; id?: string } | null
): boolean {
  if (!user) return false;
  return (
    user.admin_role === 'parent_super_admin' ||
    user.admin_role === 'super_admin' ||
    user.email === 'ajayramanan17@gmail.com' ||
    user.id === 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b'
  );
}

/**
 * Checks whether a user is a Child Super Admin.
 */
export function isChildSuperAdmin(
  user?: { admin_role?: string } | null
): boolean {
  if (!user) return false;
  return user.admin_role === 'child_super_admin';
}

