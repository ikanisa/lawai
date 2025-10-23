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
import { setAdminSessionAccessor } from './api/client';

export interface AdminSessionData {
  orgId: string;
  actorId: string;
  environment: 'development' | 'staging' | 'production';
  roles: string[];
  organizations: string[];
}

interface AdminSessionContextValue {
  session: AdminSessionData | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

async function fetchAdminSession(): Promise<AdminSessionData | null> {
  const response = await fetch('/api/admin/session', {
    cache: 'no-store',
    credentials: 'include',
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to load admin session');
  }

  const payload = (await response.json()) as {
    data?: Partial<AdminSessionData>;
  };
  const data = payload.data ?? (payload as Partial<AdminSessionData>);

  if (!data?.orgId || !data?.actorId || !data?.environment) {
    return null;
  }

  return {
    orgId: data.orgId,
    actorId: data.actorId,
    environment: data.environment,
    roles: data.roles ?? [],
    organizations: data.organizations ?? [],
  };
}

interface ProviderProps {
  children: ReactNode;
  initialSession?: AdminSessionData | null;
}

export function AdminSessionProvider({ children, initialSession = null }: ProviderProps) {
  const [session, setSession] = useState<AdminSessionData | null>(initialSession);
  const [loading, setLoading] = useState<boolean>(!initialSession);
  const [error, setError] = useState<Error | null>(null);
  const sessionRef = useRef<AdminSessionData | null>(initialSession);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    setAdminSessionAccessor(() => {
      const current = sessionRef.current;
      if (!current) return null;
      return { actorId: current.actorId, orgId: current.orgId };
    });
  }, []);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminSession();
      setSession(data);
      sessionRef.current = data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch admin session');
      setError(error);
      setSession(null);
      sessionRef.current = null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSession) {
      return;
    }
    void loadSession();
  }, [initialSession, loadSession]);

  const value = useMemo<AdminSessionContextValue>(
    () => ({
      session,
      loading,
      error,
      refresh: loadSession,
    }),
    [session, loading, error, loadSession],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionContextValue {
  const context = useContext(AdminSessionContext);
  if (!context) {
    throw new Error('useAdminSession must be used within an AdminSessionProvider');
  }
  return context;
}
