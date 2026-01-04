"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useMemo, useState, useEffect } from "react";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";

import { AccessibilityProvider } from "@/lib/a11y";
import { I18nProvider } from "@/lib/i18n";
import { TelemetryProvider } from "@/lib/telemetry";
import { TelemetryDashboardProvider } from "@/lib/telemetry-dashboard";
import { OutboxProvider } from "@/lib/offline/outbox";
import { UIStateProvider, useUIState, type ThemePreference } from "@/lib/state/ui-store";
import { ServiceWorkerBridge } from "@/lib/pwa/service-worker-bridge";
import { Toaster } from "@/components/ui/toaster";

const queryClientOptions = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30 * 1000
    },
    mutations: {
      retry: 1
    }
  }
} satisfies Parameters<typeof QueryClient>[0];

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient(queryClientOptions));

  const themeValue = useMemo(() => ({ dark: "dark", light: "light", contrast: "contrast" }), []);

  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      value={themeValue}
    >
      <AccessibilityProvider>
        <TelemetryProvider>
          <TelemetryDashboardProvider>
            <OutboxProvider>
              <I18nProvider>
                <UIStateProvider>
                  <QueryClientProvider client={queryClient}>
                    <ThemeBridge />
                    <ServiceWorkerBridge />
                    {children}
                    <Toaster />
                  </QueryClientProvider>
                </UIStateProvider>
              </I18nProvider>
            </OutboxProvider>
          </TelemetryDashboardProvider>
        </TelemetryProvider>
      </AccessibilityProvider>
    </NextThemeProvider>
  );
}

function ThemeBridge() {
  const { resolvedTheme, setTheme: setNextTheme } = useTheme();
  const theme = useUIState((state) => state.theme);
  const setTheme = useUIState((state) => state.setTheme);

  useEffect(() => {
    if (resolvedTheme && resolvedTheme !== theme) {
      setTheme(resolvedTheme as ThemePreference);
    }
  }, [resolvedTheme, setTheme, theme]);

  useEffect(() => {
    if (theme && theme !== resolvedTheme) {
      setNextTheme(theme);
    }
  }, [theme, resolvedTheme, setNextTheme]);

  return null;
}
