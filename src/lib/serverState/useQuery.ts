import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { UseQueryOptions, UseQueryResult, QueryState } from './types';
import { useQueryClient } from './QueryClientContext';
import { serializeQueryKey } from './queryClient';

const defaultEmptyState: QueryState<unknown> = {
  data: undefined,
  error: null,
  status: 'idle',
  isFetching: false,
  updatedAt: 0,
};

export function useQuery<T = unknown>(options: UseQueryOptions<T>): UseQueryResult<T> {
  const client = useQueryClient();
  const {
    queryKey,
    enabled = true,
    staleTime = 30_000,
    gcTime = 300_000,
    refetchOnWindowFocus = true,
    refetchInterval,
    initialData,
  } = options;

  const serializedKey = useMemo(() => serializeQueryKey(queryKey), [queryKey]);

  // Keep latest options in ref to avoid re-subscription loops
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return client.subscribe(queryKey, onStoreChange, gcTime);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, serializedKey, gcTime]
  );

  const getSnapshot = useCallback(() => {
    return client.getQueryState<T>(queryKey) ?? defaultEmptyState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, serializedKey]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const refetch = useCallback(async () => {
    return client.fetchQuery(optionsRef.current, true);
  }, [client]);

  // Fetch trigger on mount or dependency changes
  useEffect(() => {
    if (!enabled) return;

    const currentState = client.getQueryState<T>(queryKey);
    const isStale = !currentState || Date.now() - currentState.updatedAt > staleTime;

    if (isStale) {
      client.fetchQuery(optionsRef.current).catch(() => {
        // Errors are captured within query state
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, serializedKey, enabled, staleTime]);

  // Automatic background revalidation on window focus / visibility change
  useEffect(() => {
    if (!enabled || !refetchOnWindowFocus || typeof window === 'undefined') return;

    let lastFocus = 0;
    const onFocusOrVisible = () => {
      const now = Date.now();
      if (now - lastFocus < 1000) return;

      if (document.visibilityState === 'visible') {
        const currentState = client.getQueryState<T>(queryKey);
        const isStale = !currentState || Date.now() - currentState.updatedAt > staleTime;
        if (isStale) {
          lastFocus = now;
          client.fetchQuery(optionsRef.current).catch(() => {});
        }
      }
    };

    window.addEventListener('visibilitychange', onFocusOrVisible);
    window.addEventListener('focus', onFocusOrVisible);

    return () => {
      window.removeEventListener('visibilitychange', onFocusOrVisible);
      window.removeEventListener('focus', onFocusOrVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, serializedKey, enabled, refetchOnWindowFocus, staleTime]);

  // Optional background interval polling
  useEffect(() => {
    if (!enabled || !refetchInterval || refetchInterval <= 0) return;

    const interval = setInterval(() => {
      client.fetchQuery(optionsRef.current, true).catch(() => {});
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [client, serializedKey, enabled, refetchInterval]);

  const data = (state.data !== undefined ? state.data : initialData) as T | undefined;
  const isLoading = (state.status === 'loading' || (state.status === 'idle' && enabled)) && data === undefined;
  const isFetching = state.isFetching;
  const isSuccess = state.status === 'success' || (state.status === 'idle' && initialData !== undefined);
  const isError = state.status === 'error';

  return {
    data,
    error: state.error,
    status: state.status,
    isLoading,
    isFetching,
    isSuccess,
    isError,
    refetch,
  };
}
