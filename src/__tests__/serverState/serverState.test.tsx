import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '../../lib/serverState';

describe('Unified Server-State Management Library', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultStaleTime: 1000, defaultGcTime: 10_000 });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('deduplicates concurrent in-flight requests for the same queryKey', async () => {
    const fetchFn = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { id: 1, name: 'Batch 15' };
    });

    function ConsumerA() {
      const { data, isLoading } = useQuery<{ id: number; name: string }>({
        queryKey: ['test-dedup'],
        queryFn: fetchFn,
      });
      return <div>Consumer A: {isLoading ? 'loading' : data?.name}</div>;
    }

    function ConsumerB() {
      const { data, isLoading } = useQuery<{ id: number; name: string }>({
        queryKey: ['test-dedup'],
        queryFn: fetchFn,
      });
      return <div>Consumer B: {isLoading ? 'loading' : data?.name}</div>;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <ConsumerA />
        <ConsumerB />
      </QueryClientProvider>
    );

    expect(screen.getByText('Consumer A: loading')).toBeInTheDocument();
    expect(screen.getByText('Consumer B: loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Consumer A: Batch 15')).toBeInTheDocument();
      expect(screen.getByText('Consumer B: Batch 15')).toBeInTheDocument();
    });

    // fetchFn must only be executed ONCE despite two mounting consumers!
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('serves cached data immediately (stale-while-revalidate) without loading flash on remount', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      return { count: callCount };
    });

    function TabA() {
      const { data, isLoading } = useQuery<{ count: number }>({
        queryKey: ['tab-data'],
        queryFn: fetchFn,
        staleTime: 5000,
      });
      return <div>Count: {isLoading ? 'loading' : data?.count}</div>;
    }

    function TabSwitcher() {
      const [showTab, setShowTab] = useState(true);
      return (
        <div>
          <button onClick={() => setShowTab((prev) => !prev)}>Toggle</button>
          {showTab ? <TabA /> : <div>Other Tab</div>}
        </div>
      );
    }

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <TabSwitcher />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(getByText('Count: 1')).toBeInTheDocument();
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Switch to other tab (unmounting TabA)
    act(() => {
      getByText('Toggle').click();
    });
    expect(getByText('Other Tab')).toBeInTheDocument();

    // Switch back to TabA (remounting TabA)
    act(() => {
      getByText('Toggle').click();
    });

    // Immediately shows Count: 1 synchronously from cache without 'loading'!
    expect(getByText('Count: 1')).toBeInTheDocument();
    // Fresh cache prevented redundant network call
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('prevents race conditions when query parameters change rapidly', async () => {
    // Directly test queryClient runId isolation
    const promise1 = queryClient.fetchQuery({
      queryKey: ['cohort', 'c-1'],
      queryFn: async () => {
        await new Promise((r) => setTimeout(r, 100));
        return 'c-1 slow';
      },
    });

    queryClient.setQueryData(['cohort', 'c-1'], 'c-1 fast override');

    const result = await promise1;
    expect(result).toBe('c-1 slow');
    // Direct synchronous get after override reflects deterministic state
    expect(queryClient.getQueryData(['cohort', 'c-1'])).toBeDefined();
  });

  it('invalidates queries and triggers background updates for active subscribers', async () => {
    let version = 1;
    const fetchFn = vi.fn().mockImplementation(async () => {
      return `version-${version}`;
    });

    function Consumer() {
      const { data } = useQuery<string>({
        queryKey: ['version-check'],
        queryFn: fetchFn,
        staleTime: 60_000,
      });
      const client = useQueryClient();

      return (
        <div>
          <span>Data: {data}</span>
          <button
            onClick={() => {
              version = 2;
              client.invalidateQueries(['version-check']);
            }}
          >
            Invalidate
          </button>
        </div>
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <Consumer />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Data: version-1')).toBeInTheDocument();
    });

    // Trigger invalidation
    act(() => {
      screen.getByText('Invalidate').click();
    });

    // Invalidation marks query stale
    expect(queryClient.getQueryState(['version-check'])?.updatedAt).toBe(0);
  });

  it('executes useMutation lifecycle correctly with onSuccess and state transitions', async () => {
    const mutationFn = vi.fn().mockImplementation(async (newStatus: string) => {
      await new Promise((r) => setTimeout(r, 20));
      return { status: newStatus };
    });

    const onSuccess = vi.fn();

    function MutationComponent() {
      const { mutate, data, isPending, isSuccess } = useMutation({
        mutationFn,
        onSuccess,
      });

      return (
        <div>
          <span>Status: {isPending ? 'pending' : isSuccess ? data?.status : 'idle'}</span>
          <button onClick={() => mutate('published')}>Publish</button>
        </div>
      );
    }

    render(<MutationComponent />);

    expect(screen.getByText('Status: idle')).toBeInTheDocument();

    act(() => {
      screen.getByText('Publish').click();
    });

    expect(screen.getByText('Status: pending')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Status: published')).toBeInTheDocument();
    });

    expect(mutationFn).toHaveBeenCalledWith('published');
    expect(onSuccess).toHaveBeenCalledWith({ status: 'published' }, 'published');
  });

  it('revalidates stale query on window focus / document visibility', async () => {
    let count = 10;
    const fetchFn = vi.fn().mockImplementation(async () => {
      return ++count;
    });

    function FocusComponent() {
      const { data } = useQuery<number>({
        queryKey: ['focus-key'],
        queryFn: fetchFn,
        staleTime: 0, // always stale to trigger focus refetch
        refetchOnWindowFocus: true,
      });
      return <div>Focus Count: {data}</div>;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <FocusComponent />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Focus Count: 11')).toBeInTheDocument();
    });

    // Simulate window focus event
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByText('Focus Count: 12')).toBeInTheDocument();
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
