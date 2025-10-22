'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { registerPwa } from '../lib/pwa';
import { PwaInstallProvider } from '../hooks/use-pwa-install';
import { SessionProvider } from './auth/session-provider';
import type { SessionPayload } from '../types/session';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children, initialSession }: { children: ReactNode; initialSession?: SessionPayload | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    registerPwa();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <SessionProvider initialSession={initialSession}>
          <PwaInstallProvider>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </PwaInstallProvider>
        </SessionProvider>
      </QueryClientProvider>
      {/* Avoid hydration mismatch for theme-controlled elements */}
      {!mounted && <div aria-hidden />}
    </ThemeProvider>
  );
}
