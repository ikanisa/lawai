'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { DEMO_ORG_ID, DEMO_USER_ID } from '../../lib/api';
import type { SessionIdentity, SessionPayload } from '../../types/session';

interface SessionProviderProps {
  children: ReactNode;
  initialSession?: SessionPayload | null;
}

interface SessionState {
  session: SessionIdentity | null;
  orgId: string;
  userId: string;
  isDemo: boolean;
  loading: boolean;
  error: string | null;
}

interface SessionContextValue extends SessionState {
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const FALLBACK_IDENTITY: SessionIdentity = {
  orgId: DEMO_ORG_ID,
  userId: DEMO_USER_ID,
};

export function SessionProvider({ children, initialSession }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>(() =>
    createState(initialSession ?? null, Boolean(initialSession))
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (initialSession) {
      setState(createState(initialSession, true));
    }
  }, [initialSession]);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (response.status === 200) {
        const payload = (await response.json()) as SessionPayload;
        if (payload?.session?.orgId && payload?.session?.userId) {
          if (!mountedRef.current) return;
          setState(createState(payload, true));
          return;
        }
        throw new Error('Invalid session payload');
      }

      if (response.status === 401) {
        if (!mountedRef.current) return;
        setState(createState(null, true));
        return;
      }

      const message = (await response.text()) || `Unexpected status ${response.status}`;
      throw new Error(message);
    } catch (error) {
      if (!mountedRef.current) return;
      setState(createErrorState(error));
    }
  }, []);

  useEffect(() => {
    if (!initialSession) {
      void refresh();
    }
  }, [initialSession, refresh]);

  const value = useMemo<SessionContextValue>(() => ({ ...state, refresh }), [state, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

function createState(payload: SessionPayload | null, hydrated: boolean): SessionState {
  if (payload) {
    return {
      session: payload.session,
      orgId: payload.session.orgId,
      userId: payload.session.userId,
      isDemo: Boolean(payload.isDemo),
      loading: !hydrated,
      error: null,
    };
  }

  return {
    session: null,
    orgId: FALLBACK_IDENTITY.orgId,
    userId: FALLBACK_IDENTITY.userId,
    isDemo: true,
    loading: !hydrated,
    error: null,
  };
}

function createErrorState(error: unknown): SessionState {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    session: null,
    orgId: FALLBACK_IDENTITY.orgId,
    userId: FALLBACK_IDENTITY.userId,
    isDemo: true,
    loading: false,
    error: message,
  };
}

export type { SessionPayload };
