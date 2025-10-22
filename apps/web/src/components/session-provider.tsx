'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { DEMO_ORG_ID, DEMO_USER_ID } from '../lib/api';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface SessionProviderInitialState {
  session: Session | null;
  orgId: string | null;
  userId: string | null;
  error: string | null;
}

export interface SessionContextValue {
  status: SessionStatus;
  session: Session | null;
  orgId: string | null;
  userId: string | null;
  isDemo: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface SessionState extends SessionContextValue {
  initialized: boolean;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function extractIdentifiers(session: Session | null): {
  orgId: string | null;
  userId: string | null;
  isDemo: boolean;
} {
  const metadata = (session?.user.user_metadata ?? {}) as Record<string, unknown>;
  const orgIdRaw = metadata.org_id ?? metadata.orgId;
  const userIdRaw = metadata.user_id ?? metadata.userId;
  const orgId = typeof orgIdRaw === 'string' ? orgIdRaw : null;
  const userIdCandidate = typeof userIdRaw === 'string' ? userIdRaw : session?.user?.id ?? null;
  const userId = userIdCandidate ?? null;
  const isDemo = orgId === DEMO_ORG_ID || userId === DEMO_USER_ID;

  return { orgId, userId, isDemo };
}

function createInitialState(initialState?: SessionProviderInitialState): SessionState {
  if (!initialState) {
    return {
      status: 'loading',
      session: null,
      orgId: null,
      userId: null,
      isDemo: true,
      error: null,
      refresh: async () => {},
      initialized: false,
    };
  }

  if (initialState.error) {
    return {
      status: 'error',
      session: null,
      orgId: null,
      userId: null,
      isDemo: true,
      error: initialState.error,
      refresh: async () => {},
      initialized: true,
    };
  }

  if (initialState.session && initialState.orgId && initialState.userId) {
    const isDemo = initialState.orgId === DEMO_ORG_ID || initialState.userId === DEMO_USER_ID;
    return {
      status: 'authenticated',
      session: initialState.session,
      orgId: initialState.orgId,
      userId: initialState.userId,
      isDemo,
      error: null,
      refresh: async () => {},
      initialized: true,
    };
  }

  return {
    status: 'unauthenticated',
    session: null,
    orgId: null,
    userId: null,
    isDemo: true,
    error: null,
    refresh: async () => {},
    initialized: true,
  };
}

export function SessionProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession?: SessionProviderInitialState;
}) {
  const [{ refresh: _, initialized, ...state }, setState] = useState<SessionState>(() =>
    createInitialState(initialSession),
  );

  const refresh = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      status: prev.status === 'authenticated' ? prev.status : 'loading',
      error: null,
    }));

    try {
      const response = await fetch('/api/auth/session', { credentials: 'include' });

      if (response.status === 401) {
        setState((prev) => ({
          ...prev,
          status: 'unauthenticated',
          session: null,
          orgId: null,
          userId: null,
          isDemo: true,
          error: null,
          initialized: true,
          refresh,
        }));
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setState((prev) => ({
          ...prev,
          status: 'error',
          session: null,
          orgId: null,
          userId: null,
          isDemo: true,
          error: payload.error ?? 'Failed to load session',
          initialized: true,
          refresh,
        }));
        return;
      }

      const payload = (await response.json()) as { session: Session; isDemo: boolean };
      const identifiers = extractIdentifiers(payload.session);
      setState({
        status: 'authenticated',
        session: payload.session,
        orgId: identifiers.orgId,
        userId: identifiers.userId,
        isDemo: payload.isDemo ?? identifiers.isDemo,
        error: null,
        initialized: true,
        refresh,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        session: null,
        orgId: null,
        userId: null,
        isDemo: true,
        error: error instanceof Error ? error.message : 'Unknown session error',
        initialized: true,
        refresh,
      }));
    }
  }, []);

  useEffect(() => {
    if (!initialized) {
      void refresh();
    }
  }, [initialized, refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      refresh,
    }),
    [state, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
