'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getPwaPreference, setPwaPreference } from '../lib/pwa';

interface PwaPreferenceContextValue {
  enabled: boolean;
  loading: boolean;
  setEnabled: (enabled: boolean) => void;
}

const PwaPreferenceContext = createContext<PwaPreferenceContextValue | undefined>(undefined);

export function PwaPreferenceProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    setEnabled(getPwaPreference());
    setLoading(false);
  }, []);

  const handleSetEnabled = useCallback((value: boolean) => {
    setEnabled(value);
    setPwaPreference(value);
  }, []);

  const value = useMemo<PwaPreferenceContextValue>(
    () => ({
      enabled,
      loading,
      setEnabled: handleSetEnabled,
    }),
    [enabled, loading, handleSetEnabled],
  );

  return <PwaPreferenceContext.Provider value={value}>{children}</PwaPreferenceContext.Provider>;
}

export function usePwaPreference(): PwaPreferenceContextValue {
  const context = useContext(PwaPreferenceContext);
  if (!context) {
    throw new Error('usePwaPreference must be used within a PwaPreferenceProvider');
  }
  return context;
}
