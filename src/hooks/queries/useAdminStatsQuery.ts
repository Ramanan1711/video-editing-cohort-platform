import { useQuery } from '../../lib/serverState';
import { getAdminStats, listUsers, type AdminStats, type UserProfile } from '../../lib/adminService';

export const ADMIN_STATS_QUERY_KEY = ['admin', 'stats'] as const;
export const ADMIN_USERS_QUERY_KEY = ['admin', 'users'] as const;

export function useAdminStatsQuery(options?: { enabled?: boolean }) {
  return useQuery<AdminStats>({
    queryKey: ADMIN_STATS_QUERY_KEY,
    queryFn: () => getAdminStats(),
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
}

export function useAdminUsersQuery(options?: { enabled?: boolean }) {
  return useQuery<UserProfile[]>({
    queryKey: ADMIN_USERS_QUERY_KEY,
    queryFn: () => listUsers(),
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
}
