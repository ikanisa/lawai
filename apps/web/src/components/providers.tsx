'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { isPwaEnvEnabled, registerPwa } from '../lib/pwa';
import { PwaInstallProvider } from '../hooks/use-pwa-install';
import { PwaPreferenceProvider, usePwaPreference } from '../hooks/use-pwa-preference';
import { SessionProvider, type SessionValue } from './session-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

const PWA_ENV_ENABLED = isPwaEnvEnabled();

function PwaRegistrationGate() {
  const { enabled, loading } = usePwaPreference();

  useEffect(() => {
    if (!PWA_ENV_ENABLED || loading || !enabled) {
      return;
    }

    registerPwa();
  }, [enabled, loading]);

  return null;
}

export function AppProviders({
  children,
  initialSession = null,
}: {
  children: ReactNode;
  initialSession?: SessionValue | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            refetchOnWindowFocus: false,
            suspense: true,
            retry: 1,
          },
        },
      }),
  );
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <SessionProvider initialSession={initialSession}>
          <PwaPreferenceProvider>
            <PwaInstallProvider>
              <PwaRegistrationGate />
              {children}
              <Toaster position="bottom-right" richColors closeButton />
            </PwaInstallProvider>
          </PwaPreferenceProvider>
        </SessionProvider>
      </QueryClientProvider>
      {!mounted && <div aria-hidden />}
    </ThemeProvider>
  );
}
