'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { getSupabaseBrowserClient } from '../lib/supabase-browser';
import {
  mapSessionToDetails,
  setAdminSessionState,
  type AdminSessionDetails,
} from '../features/admin-panel/api/session-store';

interface SessionContextValue {
  loading: boolean;
  session: AdminSessionDetails | null;
}

const SessionContext = createContext<SessionContextValue>({ loading: true, session: null });

function updateStores(session: Session | null, setState: (value: SessionContextValue) => void) {
  const details = mapSessionToDetails(session);
  setAdminSessionState(session);
  setState({ loading: false, session: details });
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<SessionContextValue>({ loading: true, session: null });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    const applySession = (session: Session | null) => {
      if (!active) return;
      updateStores(session, setValue);
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const contextValue = useMemo(() => value, [value]);

  return <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>;
}

export function useAppSession(): SessionContextValue {
  return useContext(SessionContext);
}
