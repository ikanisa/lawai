'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { PWA_REGISTRATION_EVENT, registerPwa } from '../lib/pwa';
import { PwaInstallProvider } from '../hooks/use-pwa-install';
import { clientEnv } from '../env.client';

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
  const enablePwa = clientEnv.NEXT_PUBLIC_ENABLE_PWA;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!enablePwa) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const handleRegister = () => {
      void registerPwa();
    };

    window.addEventListener(PWA_REGISTRATION_EVENT, handleRegister);
    return () => {
      window.removeEventListener(PWA_REGISTRATION_EVENT, handleRegister);
    };
  }, [enablePwa]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <PwaInstallProvider enablePwa={enablePwa}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </PwaInstallProvider>
      </QueryClientProvider>
      {/* Avoid hydration mismatch for theme-controlled elements */}
      {!mounted && <div aria-hidden />}
    </ThemeProvider>
  );
}
