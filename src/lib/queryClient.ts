import { QueryClient } from '@tanstack/react-query';

// The one QueryClient for the whole app. Import this anywhere you need to
// touch the cache outside of a hook (e.g. invalidate after a cart mutation).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // product data doesn't change second to second
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
