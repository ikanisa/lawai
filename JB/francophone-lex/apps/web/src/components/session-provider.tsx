'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface SessionValue {
  orgId: string;
  userId: string;
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionContextValue {
  status: SessionStatus;
  session: SessionValue | null;
  refresh: () => Promise<void>;
  setSession: (session: SessionValue | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
  initialSession?: SessionValue | null;
  loader?: () => Promise<SessionValue | null>;
}

interface SessionBootstrapWindow extends Window {
  __AVOCAT_SESSION__?: unknown;
}

const EMPTY_SESSION: SessionValue = Object.freeze({ orgId: '', userId: '' });

let cachedSession: SessionValue | null = null;
let cachedStatus: SessionStatus = 'loading';
let waiters: Array<(session: SessionValue | null, status: SessionStatus) => void> = [];
let pendingPromise: Promise<SessionValue | null> | null = null;

function notify(session: SessionValue | null, status: SessionStatus) {
  cachedSession = session;
  cachedStatus = status;

  if (status === 'loading') {
    pendingPromise = null;
    return;
  }

  const listeners = waiters;
  waiters = [];
  for (const listener of listeners) {
    listener(session, status);
  }
  pendingPromise = Promise.resolve(session);
}

function parseSession(value: unknown): SessionValue | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const maybe = value as Record<string, unknown>;
  const orgId = maybe.orgId;
  const userId = maybe.userId;
  if (typeof orgId === 'string' && typeof userId === 'string') {
    return { orgId, userId };
  }
  return null;
}

function readBootstrapSession(initial?: SessionValue | null): SessionValue | null {
  if (initial) {
    return initial;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  return parseSession((window as SessionBootstrapWindow).__AVOCAT_SESSION__);
}

const DEFAULT_LOADER = async (): Promise<SessionValue | null> => {
  try {
    const response = await fetch('/api/session', { credentials: 'include' });
    if (!response.ok) {
      if (response.status === 401 || response.status === 404) {
        return null;
      }
      throw new Error(`Session request failed: ${response.status}`);
    }
    const data = (await response.json()) as Record<string, unknown>;
    return parseSession(data);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('session_load_failed', error);
    }
    return null;
  }
};

export function getCachedSession(): SessionValue | null {
  return cachedSession;
}

export function getCachedSessionStatus(): SessionStatus {
  return cachedStatus;
}

export function waitForSession(): Promise<SessionValue | null> {
  if (cachedStatus === 'authenticated' || cachedStatus === 'unauthenticated') {
    return Promise.resolve(cachedSession);
  }
  if (!pendingPromise) {
    pendingPromise = new Promise((resolve) => {
      waiters.push((session) => resolve(session));
    });
  }
  return pendingPromise;
}

export class UnauthenticatedError extends Error {
  constructor(message = 'User session required') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

export function SessionProvider({ children, initialSession, loader }: SessionProviderProps) {
  const bootstrap = useMemo(() => readBootstrapSession(initialSession ?? null), [initialSession]);
  const [session, setSession] = useState<SessionValue | null>(bootstrap);
  const [status, setStatus] = useState<SessionStatus>(() => (bootstrap ? 'authenticated' : 'loading'));
  const loaderRef = useRef(loader ?? DEFAULT_LOADER);

  useEffect(() => {
    loaderRef.current = loader ?? DEFAULT_LOADER;
  }, [loader]);

  useEffect(() => {
    if (bootstrap) {
      if (typeof window !== 'undefined') {
        (window as SessionBootstrapWindow).__AVOCAT_SESSION__ = bootstrap;
      }
    }
    notify(bootstrap, bootstrap ? 'authenticated' : 'loading');
  }, [bootstrap]);

  const applySession = useCallback((next: SessionValue | null) => {
    if (next) {
      setSession(next);
      setStatus('authenticated');
      if (typeof window !== 'undefined') {
        (window as SessionBootstrapWindow).__AVOCAT_SESSION__ = next;
      }
    } else {
      setSession(null);
      setStatus('unauthenticated');
      if (typeof window !== 'undefined') {
        delete (window as SessionBootstrapWindow).__AVOCAT_SESSION__;
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    setStatus('loading');
    notify(null, 'loading');
    try {
      const next = await loaderRef.current();
      applySession(next);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('session_refresh_failed', error);
      }
      applySession(null);
    }
  }, [applySession]);

  useEffect(() => {
    if (!session && status === 'loading') {
      void refresh();
    }
  }, [refresh, session, status]);

  useEffect(() => {
    notify(session, status);
  }, [session, status]);

  const value = useMemo<SessionContextValue>(() => ({
    status,
    session,
    refresh,
    setSession: applySession,
  }), [applySession, refresh, session, status]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}

export function useRequiredSession(): SessionValue {
  const { session, status } = useSession();
  if (session) {
    return session;
  }
  if (status === 'unauthenticated') {
    throw new UnauthenticatedError();
  }
  return EMPTY_SESSION;
}
