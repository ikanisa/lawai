'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { hasPwaConsent, isPwaFeatureEnabled, registerPwa } from '@/lib/pwa';
import { PwaInstallProvider } from '@/hooks/use-pwa-install';

export function AppProviders({ children }: { children: ReactNode }) {
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
    if (isPwaFeatureEnabled() && hasPwaConsent()) {
      void registerPwa();
    }
  }, []);

  return (
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
  );
}
