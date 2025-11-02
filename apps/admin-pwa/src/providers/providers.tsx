'use client';

import { ReactNode, createElement, useEffect, useState, type ComponentType } from 'react';
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
  type DehydratedState,
  type HydrationBoundaryProps,
} from '@tanstack/react-query';
import { initAxe } from '@/lib/axe';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            gcTime: 1000 * 60 * 10,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    void initAxe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export function Hydrate({ state, children }: { state: DehydratedState | undefined; children: ReactNode }) {
  return createElement(HydrationBoundary as unknown as ComponentType<HydrationBoundaryProps>, {
    state: state ?? null,
    children,
  } as HydrationBoundaryProps);
}
