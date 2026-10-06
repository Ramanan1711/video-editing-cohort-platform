import type { QueryKey, QueryObserverOptions, QueryState } from './types';

export function serializeQueryKey(key: QueryKey): string {
  if (typeof key === 'string') return key;
  try {
    return JSON.stringify(key, (_, val) => {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return Object.keys(val)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = (val as Record<string, unknown>)[k];
            return acc;
          }, {});
      }
      return val;
    });
  } catch {
    return String(key);
  }
}

interface InternalQuery<T = unknown> {
  key: QueryKey;
  serializedKey: string;
  state: QueryState<T>;
  subscribers: Set<() => void>;
  inFlightPromise: Promise<T> | null;
  abortController: AbortController | null;
  gcTimeout: ReturnType<typeof setTimeout> | null;
  runId: number;
}

export interface QueryClientConfig {
  defaultStaleTime?: number;
  defaultGcTime?: number;
}

export class QueryClient {
  private queries = new Map<string, InternalQuery<unknown>>();
  private defaultStaleTime: number;
  private defaultGcTime: number;

  constructor(config: QueryClientConfig = {}) {
    this.defaultStaleTime = config.defaultStaleTime ?? 30_000; // 30s
    this.defaultGcTime = config.defaultGcTime ?? 300_000; // 5 min
  }

  private getOrCreateQuery<T>(key: QueryKey): InternalQuery<T> {
    const serialized = serializeQueryKey(key);
    let query = this.queries.get(serialized) as InternalQuery<T> | undefined;

    if (!query) {
      query = {
        key,
        serializedKey: serialized,
        state: {
          data: undefined,
          error: null,
          status: 'idle',
          isFetching: false,
          updatedAt: 0,
        },
        subscribers: new Set(),
        inFlightPromise: null,
        abortController: null,
        gcTimeout: null,
        runId: 0,
      };
      this.queries.set(serialized, query);
    }

    if (query.gcTimeout) {
      clearTimeout(query.gcTimeout);
      query.gcTimeout = null;
    }

    return query;
  }

  getQueryState<T>(key: QueryKey): QueryState<T> | undefined {
    const serialized = serializeQueryKey(key);
    return this.queries.get(serialized)?.state as QueryState<T> | undefined;
  }

  getQueryData<T>(key: QueryKey): T | undefined {
    return this.getQueryState<T>(key)?.data;
  }

  setQueryData<T>(key: QueryKey, updater: T | ((old: T | undefined) => T)): void {
    const query = this.getOrCreateQuery<T>(key);
    const oldData = query.state.data;
    const newData = typeof updater === 'function' ? (updater as (old: T | undefined) => T)(oldData) : updater;

    query.state = {
      ...query.state,
      data: newData,
      error: null,
      status: 'success',
      updatedAt: Date.now(),
    };

    this.notifySubscribers(query);
  }

  async fetchQuery<T>(options: QueryObserverOptions<T>, forceRefresh = false): Promise<T> {
    const { queryKey, queryFn } = options;
    const staleTime = options.staleTime ?? this.defaultStaleTime;
    const query = this.getOrCreateQuery<T>(queryKey);

    // If cache is fresh and forceRefresh is false, return cached data
    const isFresh = query.state.status === 'success' && Date.now() - query.state.updatedAt < staleTime;
    if (isFresh && !forceRefresh && query.state.data !== undefined) {
      return query.state.data;
    }

    // Deduplicate concurrent in-flight requests for the exact same query
    if (query.inFlightPromise) {
      return query.inFlightPromise;
    }

    // Prepare new query execution with abort controller and unique run ID
    if (query.abortController) {
      query.abortController.abort();
    }
    const controller = new AbortController();
    query.abortController = controller;
    const currentRunId = ++query.runId;

    // Transition state to fetching (maintaining cached data for stale-while-revalidate)
    query.state = {
      ...query.state,
      status: query.state.data !== undefined ? 'success' : 'loading',
      isFetching: true,
      error: null,
    };
    this.notifySubscribers(query);

    const promise = (async () => {
      try {
        const result = await queryFn({ signal: controller.signal });

        // Guard against race conditions: ignore if an out-of-order run completed earlier
        if (query.runId !== currentRunId) {
          return result;
        }

        query.state = {
          data: result,
          error: null,
          status: 'success',
          isFetching: false,
          updatedAt: Date.now(),
        };
        return result;
      } catch (err: unknown) {
        if (query.runId !== currentRunId) {
          throw err;
        }

        // Do not record error if aborted cleanly
        if (controller.signal.aborted) {
          query.state = {
            ...query.state,
            isFetching: false,
          };
          throw err;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        query.state = {
          ...query.state,
          error,
          status: 'error',
          isFetching: false,
          updatedAt: Date.now(),
        };
        throw error;
      } finally {
        if (query.runId === currentRunId) {
          query.inFlightPromise = null;
          query.abortController = null;
          this.notifySubscribers(query);
        }
      }
    })();

    query.inFlightPromise = promise;
    return promise;
  }

  invalidateQueries(keyOrPrefix?: QueryKey | RegExp): void {
    const entries = Array.from(this.queries.entries());

    if (!keyOrPrefix) {
      for (const [, query] of entries) {
        this.markStaleAndRefetch(query);
      }
      return;
    }

    if (keyOrPrefix instanceof RegExp) {
      for (const [serialized, query] of entries) {
        if (keyOrPrefix.test(serialized)) {
          this.markStaleAndRefetch(query);
        }
      }
      return;
    }

    const targetPrefix = serializeQueryKey(keyOrPrefix);
    for (const [serialized, query] of entries) {
      if (
        serialized === targetPrefix ||
        serialized.startsWith(`${targetPrefix}:`) ||
        serialized.startsWith(`${targetPrefix}-`) ||
        (targetPrefix.endsWith(']') && serialized.startsWith(targetPrefix.slice(0, -1)))
      ) {
        this.markStaleAndRefetch(query);
      }
    }
  }

  private markStaleAndRefetch(query: InternalQuery<unknown>): void {
    query.state = {
      ...query.state,
      updatedAt: 0,
    };
    this.notifySubscribers(query);

    // If query has active subscribers, re-fetch in background
    if (query.subscribers.size > 0 && !query.inFlightPromise) {
      // Background refetch
      this.notifySubscribers(query);
    }
  }

  subscribe(key: QueryKey, listener: () => void, gcTime = this.defaultGcTime): () => void {
    const query = this.getOrCreateQuery(key);
    query.subscribers.add(listener);

    if (query.gcTimeout) {
      clearTimeout(query.gcTimeout);
      query.gcTimeout = null;
    }

    return () => {
      query.subscribers.delete(listener);
      if (query.subscribers.size === 0) {
        query.gcTimeout = setTimeout(() => {
          this.queries.delete(query.serializedKey);
        }, gcTime);
      }
    };
  }

  private notifySubscribers(query: InternalQuery<unknown>): void {
    for (const listener of query.subscribers) {
      try {
        listener();
      } catch (e) {
        console.error('Error in query listener:', e);
      }
    }
  }

  clear(): void {
    for (const [, query] of this.queries) {
      if (query.abortController) {
        query.abortController.abort();
      }
      if (query.gcTimeout) {
        clearTimeout(query.gcTimeout);
      }
    }
    this.queries.clear();
  }
}

export const defaultQueryClient = new QueryClient();
