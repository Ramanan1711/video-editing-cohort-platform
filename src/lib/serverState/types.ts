export type QueryKey = readonly unknown[] | string;

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface QueryState<T = unknown> {
  data: T | undefined;
  error: Error | null;
  status: QueryStatus;
  isFetching: boolean;
  updatedAt: number;
}

export interface QueryObserverOptions<T = unknown> {
  queryKey: QueryKey;
  queryFn: (context: { signal: AbortSignal }) => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number;
  initialData?: T;
}

export type UseQueryOptions<T = unknown> = QueryObserverOptions<T>;

export interface UseQueryResult<T = unknown> {
  data: T | undefined;
  error: Error | null;
  status: QueryStatus;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;
  refetch: () => Promise<T | undefined>;
}

export interface UseMutationOptions<TData = unknown, TVariables = void> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: Error, variables: TVariables) => void | Promise<void>;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void | Promise<void>;
}

export interface UseMutationResult<TData = unknown, TVariables = void> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | undefined;
  error: Error | null;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  reset: () => void;
}
