'use client';

import { QueryClientProvider, HydrationBoundary } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { registerPwa } from '@/lib/pwa';
import { PwaInstallProvider } from '@/features/platform/hooks/use-pwa-install';
import { createQueryClient } from '@/lib/query';

export function AppProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(() => createQueryClient());
  useEffect(() => {
    setMounted(true);
    registerPwa();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <HydrationBoundary>
          <PwaInstallProvider>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </PwaInstallProvider>
        </HydrationBoundary>
      </QueryClientProvider>
      {/* Avoid hydration mismatch for theme-controlled elements */}
      {!mounted && <div aria-hidden />}
    </ThemeProvider>
  );
}
