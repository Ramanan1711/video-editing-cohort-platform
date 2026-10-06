import type { ReactNode } from 'react';
import { QueryClient, defaultQueryClient } from './queryClient';
import { QueryClientContext } from './QueryClientContext';

export interface QueryClientProviderProps {
  client?: QueryClient;
  children: ReactNode;
}

export function QueryClientProvider({
  client = defaultQueryClient,
  children,
}: QueryClientProviderProps) {
  return (
    <QueryClientContext.Provider value={client}>
      {children}
    </QueryClientContext.Provider>
  );
}
