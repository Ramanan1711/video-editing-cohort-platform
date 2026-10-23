import { useQuery } from '../../lib/serverState';
import { getUserEnrollments, type UserEnrollmentRecord } from '../../lib/courseService';

export const USER_ENROLLMENTS_QUERY_KEY = (userId?: string) =>
  ['user_enrollments', userId || 'anonymous'] as const;

export function useUserEnrollmentsQuery(
  userId: string | undefined,
  options?: { enabled?: boolean; staleTime?: number }
) {
  const isEnabled = Boolean(userId && (options?.enabled ?? true));
  return useQuery<UserEnrollmentRecord[]>({
    queryKey: USER_ENROLLMENTS_QUERY_KEY(userId),
    queryFn: () => (userId ? getUserEnrollments(userId) : Promise.resolve([])),
    enabled: isEnabled,
    staleTime: options?.staleTime ?? 30_000,
  });
}

