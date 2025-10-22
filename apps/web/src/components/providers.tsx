'use client';

import { createClient, type Session as SupabaseSession } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { clientEnv } from '../env.client';
import { configureApiSession, DEMO_ORG_ID, DEMO_USER_ID } from '../lib/api';
import { registerPwa } from '../lib/pwa';
import { PwaInstallProvider } from '../hooks/use-pwa-install';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'demo';

interface SessionState {
  status: SessionStatus;
  orgId: string | null;
  userId: string | null;
  supabaseSession: SupabaseSession | null;
  error: Error | null;
  isDemo: boolean;
}

interface SessionContextValue extends SessionState {
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function deriveOrgIdFromSupabase(session: SupabaseSession | null): string | null {
  if (!session?.user) {
    return null;
  }

  const sources = [session.user.user_metadata, session.user.app_metadata] as Array<Record<string, unknown> | null | undefined>;
  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue;
    }
    const candidate =
      (source.orgId as unknown) ??
      (source.orgID as unknown) ??
      (source.org_id as unknown) ??
      (source.org as unknown);
    if (isNonEmptyString(candidate)) {
      return candidate;
    }
  }

  return null;
}

function deriveUserIdFromSupabase(session: SupabaseSession | null): string | null {
  if (!session?.user) {
    return null;
  }

  const directId = session.user.id;
  if (isNonEmptyString(directId)) {
    return directId;
  }

  const sources = [session.user.user_metadata, session.user.app_metadata] as Array<Record<string, unknown> | null | undefined>;
  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue;
    }
    const candidate =
      (source.userId as unknown) ??
      (source.userID as unknown) ??
      (source.user_id as unknown) ??
      (source.id as unknown);
    if (isNonEmptyString(candidate)) {
      return candidate;
    }
  }

  return null;
}

function deriveOrgIdFromNextAuth(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const user = typeof data.user === 'object' && data.user !== null ? (data.user as Record<string, unknown>) : undefined;

  const candidates = [
    data.orgId,
    data.orgID,
    data.org_id,
    data.org,
    user?.orgId,
    user?.orgID,
    user?.org_id,
    user?.org,
  ];

  for (const candidate of candidates) {
    if (isNonEmptyString(candidate)) {
      return candidate;
    }
  }

  return null;
}

function deriveUserIdFromNextAuth(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const user = typeof data.user === 'object' && data.user !== null ? (data.user as Record<string, unknown>) : undefined;

  const candidates = [
    data.userId,
    data.userID,
    data.user_id,
    user?.id,
    user?.userId,
    user?.userID,
    user?.user_id,
  ];

  for (const candidate of candidates) {
    if (isNonEmptyString(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function useAppSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useAppSession must be used within AppProviders');
  }
  return context;
}

function SessionProvider({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    orgId: null,
    userId: null,
    supabaseSession: null,
    error: null,
    isDemo: false,
  });

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const allowDemoFallback = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return true;
      }
      if (window.location.pathname.includes('storybook')) {
        return true;
      }
    }
    return false;
  }, []);

  const supabase = useMemo(() => {
    const url = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return null;
    }
    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }, []);

  const applySession = useCallback(
    ({
      session,
      orgId,
      userId,
      error,
      forceDemo,
    }: {
      session: SupabaseSession | null;
      orgId?: string | null;
      userId?: string | null;
      error?: Error | null;
      forceDemo?: boolean;
    }) => {
      if (!isMountedRef.current) {
        return;
      }

      const resolvedOrgId = isNonEmptyString(orgId) ? orgId : deriveOrgIdFromSupabase(session);
      const resolvedUserId = isNonEmptyString(userId) ? userId : deriveUserIdFromSupabase(session);

      if (resolvedOrgId && resolvedUserId && !forceDemo) {
        setState({
          status: 'authenticated',
          orgId: resolvedOrgId,
          userId: resolvedUserId,
          supabaseSession: session,
          error: null,
          isDemo: false,
        });
        return;
      }

      if ((forceDemo ?? false) || allowDemoFallback) {
        setState({
          status: 'demo',
          orgId: DEMO_ORG_ID,
          userId: DEMO_USER_ID,
          supabaseSession: session,
          error: error ?? null,
          isDemo: true,
        });
        return;
      }

      setState({
        status: 'unauthenticated',
        orgId: null,
        userId: null,
        supabaseSession: session,
        error: error ?? new Error('session_unavailable'),
        isDemo: false,
      });
    },
    [allowDemoFallback],
  );

  const hydrateSession = useCallback(async () => {
    if (supabase) {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        applySession({ session: null, error: error instanceof Error ? error : new Error(error.message ?? 'session_error') });
        return;
      }
      applySession({ session: data.session ?? null });
      return;
    }

    try {
      const response = await fetch('/api/auth/session', { credentials: 'include' });
      if (!response.ok) {
        applySession({ session: null, error: new Error(`session_request_failed:${response.status}`) });
        return;
      }
      const payload = await response.json();
      const nextOrgId = deriveOrgIdFromNextAuth(payload);
      const nextUserId = deriveUserIdFromNextAuth(payload);
      if (nextOrgId && nextUserId) {
        applySession({ session: null, orgId: nextOrgId, userId: nextUserId });
        return;
      }
      applySession({ session: null, error: new Error('session_missing_metadata') });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('session_unavailable');
      applySession({ session: null, error: err });
    }
  }, [applySession, supabase]);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession({ session: session ?? null });
    });
    return () => {
      subscription.subscription?.unsubscribe();
    };
  }, [applySession, supabase]);

  const refresh = useCallback(async () => {
    await hydrateSession();
  }, [hydrateSession]);

  const previousIdsRef = useRef<{ orgId: string | null; userId: string | null }>({ orgId: null, userId: null });
  useEffect(() => {
    const prev = previousIdsRef.current;
    if (state.orgId && state.userId && (state.orgId !== prev.orgId || state.userId !== prev.userId)) {
      queryClient.clear();
      previousIdsRef.current = { orgId: state.orgId, userId: state.userId };
    }
  }, [queryClient, state.orgId, state.userId]);

  useEffect(() => {
    configureApiSession({
      orgId: state.orgId,
      userId: state.userId,
      allowDemoFallback,
    });
  }, [allowDemoFallback, state.orgId, state.userId, state.status]);

  const contextValue = useMemo<SessionContextValue>(() => ({
    ...state,
    refresh,
  }), [state, refresh]);

  return <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  useEffect(() => {
    setMounted(true);
    registerPwa();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <SessionProvider queryClient={queryClient}>
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
