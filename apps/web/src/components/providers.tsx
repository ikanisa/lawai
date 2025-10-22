'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { registerPwa } from '../lib/pwa';
import { PwaInstallProvider } from '../hooks/use-pwa-install';
import { PwaPreferenceProvider, usePwaPreference } from '../hooks/use-pwa-preference';

function PwaRegistrationGate() {
  const { enabled, canToggle } = usePwaPreference();

  useEffect(() => {
    if (!enabled || !canToggle) {
      return;
    }
    registerPwa();
  }, [enabled, canToggle]);

  return null;
}

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
