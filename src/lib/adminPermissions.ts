// src/lib/adminPermissions.ts
// Granular Role-Based Access Control (RBAC) Matrix for Administration

export type AdminSubRole = 'super_admin' | 'content_admin' | 'operations_admin' | 'moderator';

export type AdminPermission =
  | 'manage_roles' // promote/demote users, change admin sub-roles
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

export const ROLE_PERMISSIONS: Record<AdminSubRole, AdminPermission[]> = {
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
  content_admin: [
    'manage_cohorts',
    'manage_curriculum',
    'publish_content',
    'view_insights',
  ],
  operations_admin: [
    'manage_cohorts',
    'manage_enrollments',
    'broadcast_announcements',
    'schedule_sessions',
    'view_insights',
  ],
  moderator: [
    'moderate_community',
    'broadcast_announcements',
    'view_insights',
  ],
};

export const ROLE_LABELS: Record<AdminSubRole, string> = {
  super_admin: 'Super Admin',
  content_admin: 'Content Admin',
  operations_admin: 'Operations Admin',
  moderator: 'Community Moderator',
};

export const ROLE_DESCRIPTIONS: Record<AdminSubRole, string> = {
  super_admin: 'Full system sovereignty: user roles, security, content publishing, and governance.',
  content_admin: 'Curriculum authoring studio, lesson asset pipeline, and content lifecycle transitions.',
  operations_admin: 'Cohort rosters, enterprise bulk student imports, dispatches, and live sessions.',
  moderator: 'Community board moderation, post reviews, and student announcements.',
};

/**
 * Checks whether an admin user holds a specific administrative privilege.
 * Defaults to 'super_admin' if admin_role is unspecified.
 */
export function hasAdminPermission(
  adminRole: AdminSubRole | undefined | null,
  permission: AdminPermission
): boolean {
  const role: AdminSubRole = adminRole || 'super_admin';
  const permissions = ROLE_PERMISSIONS[role];
  return Boolean(permissions && permissions.includes(permission));
}

