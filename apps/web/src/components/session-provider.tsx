'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEMO_ORG_ID, DEMO_USER_ID } from '../lib/api';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AppSession {
  orgId: string;
  userId: string;
}

interface SessionFetchResult {
  session: AppSession | null;
  isDemo?: boolean;
}

export interface SessionContextValue {
  status: SessionStatus;
  session: AppSession | null;
  isDemo: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface SessionProviderProps {
  children: ReactNode;
  /**
   * Allow tests or storybook to prime the session without hitting the network.
   */
  initialSession?: AppSession | null;
  /**
   * Custom fetcher (mostly used in tests).
   */
  fetchSession?: () => Promise<SessionFetchResult>;
}

const ALLOW_DEMO_FALLBACK = process.env.NODE_ENV !== 'production';

const DEFAULT_FETCH_SESSION = async (): Promise<SessionFetchResult> => {
  const response = await fetch('/api/auth/session', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (response.status === 401) {
    return { session: null, isDemo: false };
  }

  if (!response.ok) {
    throw new Error('session_fetch_failed');
  }

  const payload = (await response.json()) as SessionFetchResult;
  return { session: payload.session, isDemo: Boolean(payload.isDemo) };
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children, initialSession, fetchSession }: SessionProviderProps) {
  const fetcherRef = useRef(fetchSession ?? DEFAULT_FETCH_SESSION);
  useEffect(() => {
    fetcherRef.current = fetchSession ?? DEFAULT_FETCH_SESSION;
  }, [fetchSession]);
  const [status, setStatus] = useState<SessionStatus>(initialSession ? 'authenticated' : 'loading');
  const [session, setSession] = useState<AppSession | null>(initialSession ?? null);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const sessionRef = useRef<AppSession | null>(initialSession ?? null);

  const setResolvedSession = useCallback((next: AppSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const ensureDemoSession = useCallback(() => {
    if (!ALLOW_DEMO_FALLBACK) {
      setStatus('unauthenticated');
      setResolvedSession(null);
      setIsDemo(false);
      return;
    }
    setResolvedSession({ orgId: DEMO_ORG_ID, userId: DEMO_USER_ID });
    setStatus('authenticated');
    setIsDemo(true);
  }, [setResolvedSession]);

  const load = useCallback(async () => {
    try {
      setError(null);
      if (!sessionRef.current) {
        setStatus('loading');
      }
      const result = await fetcherRef.current();
      if (result.session) {
        setResolvedSession(result.session);
        setStatus('authenticated');
        setIsDemo(Boolean(result.isDemo));
        return;
      }
      if (ALLOW_DEMO_FALLBACK) {
        ensureDemoSession();
        return;
      }
      setStatus('unauthenticated');
      setResolvedSession(null);
      setIsDemo(false);
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('session_fetch_failed');
      setError(nextError);
      if (sessionRef.current) {
        // Keep the previous session if we already had one.
        return;
      }
      if (ALLOW_DEMO_FALLBACK) {
        ensureDemoSession();
        return;
      }
      setStatus('unauthenticated');
      setResolvedSession(null);
      setIsDemo(false);
    }
  }, [ensureDemoSession, setResolvedSession]);

  useEffect(() => {
    if (initialSession) {
      setIsDemo(false);
      sessionRef.current = initialSession;
      return;
    }
    void load();
  }, [initialSession, load]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      isDemo,
      error,
      refresh: load,
    }),
    [error, isDemo, load, session, status],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}
