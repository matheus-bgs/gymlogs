import { QueryClient } from '@tanstack/react-query';

// Singleton QueryClient — imported by both the Provider and Login prefetching
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for 2 minutes by default
            staleTime: 2 * 60 * 1000,
            // Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Retry once on failure
            retry: 1,
            // Don't refetch just because the window regains focus
            refetchOnWindowFocus: false,
        },
    },
});

export default queryClient;
