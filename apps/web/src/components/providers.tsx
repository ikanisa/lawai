'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { UiThemeProvider } from '@avocat-ai/ui';
import { SessionProvider } from '@avocat-ai/auth';

import { registerPwa } from '../lib/pwa';
import { PwaInstallProvider } from '../hooks/use-pwa-install';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    registerPwa();
  }, []);

  return (
    <SessionProvider>
      <UiThemeProvider theme="web">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <QueryClientProvider client={queryClient}>
            <PwaInstallProvider>
              {children}
              <Toaster position="bottom-right" richColors closeButton />
            </PwaInstallProvider>
          </QueryClientProvider>
          {/* Avoid hydration mismatch for theme-controlled elements */}
          {!mounted && <div aria-hidden />}
        </ThemeProvider>
      </UiThemeProvider>
    </SessionProvider>
  );
}
