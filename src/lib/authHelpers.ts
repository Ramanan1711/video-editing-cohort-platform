// Helper for role-aware routing throughout the platform

export type AppRole = 'student' | 'mentor' | 'admin';

export function getDashboardRouteForRole(role?: string | null): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'mentor':
      return '/review/submissions';
    case 'student':
    default:
      return '/student/dashboard';
  }
}

