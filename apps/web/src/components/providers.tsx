'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { isPwaEnvEnabled, registerPwa } from '../lib/pwa';
import { PwaInstallProvider } from '../hooks/use-pwa-install';
import { PwaPreferenceProvider, usePwaPreference } from '../hooks/use-pwa-preference';

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

export function AppProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <PwaPreferenceProvider>
          <PwaInstallProvider>
            <PwaRegistrationGate />
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </PwaInstallProvider>
        </PwaPreferenceProvider>
      </QueryClientProvider>
      {/* Avoid hydration mismatch for theme-controlled elements */}
      {!mounted && <div aria-hidden />}
    </ThemeProvider>
  );
}
