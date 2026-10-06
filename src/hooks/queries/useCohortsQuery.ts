import { useQuery } from '../../lib/serverState';
import { listCohorts, type Cohort } from '../../lib/courseService';

export const COHORTS_QUERY_KEY = ['cohorts'] as const;

export function useCohortsQuery(options?: { enabled?: boolean; staleTime?: number }) {
  return useQuery<Cohort[]>({
    queryKey: COHORTS_QUERY_KEY,
    queryFn: () => listCohorts(),
    staleTime: options?.staleTime ?? 60_000, // 1 minute fresh
    enabled: options?.enabled ?? true,
  });
}
