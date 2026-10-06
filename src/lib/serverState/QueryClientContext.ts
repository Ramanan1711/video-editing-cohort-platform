import { createContext, useContext } from 'react';
import { QueryClient, defaultQueryClient } from './queryClient';

export const QueryClientContext = createContext<QueryClient>(defaultQueryClient);

export function useQueryClient(): QueryClient {
  return useContext(QueryClientContext);
}
