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
import {
  PWA_OPT_IN_STORAGE_KEY,
  getPwaOptInPreference,
  isPwaFeatureEnabled,
  registerPwa,
  setPwaOptInPreference,
} from '../lib/pwa';

interface PwaPreferenceContextValue {
  enabled: boolean;
  ready: boolean;
  setEnabled: (enabled: boolean) => void;
}

const PwaPreferenceContext = createContext<PwaPreferenceContextValue | undefined>(undefined);

export function PwaPreferenceProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setEnabledState(getPwaOptInPreference());
    setReady(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PWA_OPT_IN_STORAGE_KEY) {
        return;
      }
      setEnabledState(event.newValue === 'true');
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isPwaFeatureEnabled()) return;
    if (!enabled) return;
    registerPwa();
  }, [enabled, ready]);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    setPwaOptInPreference(next);
  }, []);

  const value = useMemo<PwaPreferenceContextValue>(() => ({ enabled, ready, setEnabled }), [enabled, ready, setEnabled]);

  return <PwaPreferenceContext.Provider value={value}>{children}</PwaPreferenceContext.Provider>;
}

export function usePwaPreference(): PwaPreferenceContextValue {
  const context = useContext(PwaPreferenceContext);
  if (!context) {
    throw new Error('usePwaPreference must be used within a PwaPreferenceProvider');
  }
  return context;
}
