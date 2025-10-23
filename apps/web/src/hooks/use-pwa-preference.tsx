'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getPwaPreference,
  isPwaGloballyEnabled,
  setPwaPreference,
  PWA_PREFERENCE_STORAGE_KEY,
} from '../lib/pwa';

interface PwaPreferenceContextValue {
  enabled: boolean;
  canToggle: boolean;
  setEnabled: (value: boolean) => void;
}

const PwaPreferenceContext = createContext<PwaPreferenceContextValue | undefined>(undefined);

export function PwaPreferenceProvider({ children }: { children: ReactNode }) {
  const canToggle = isPwaGloballyEnabled();
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (!canToggle) {
      return false;
    }
    return getPwaPreference();
  });

  useEffect(() => {
    if (!canToggle) {
      setEnabledState(false);
      return;
    }
    setEnabledState(getPwaPreference());
  }, [canToggle]);

  useEffect(() => {
    if (!canToggle || typeof window === 'undefined') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PWA_PREFERENCE_STORAGE_KEY) {
        return;
      }
      setEnabledState(event.newValue !== 'disabled');
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [canToggle]);

  const setEnabled = useCallback(
    (value: boolean) => {
      if (!canToggle) {
        return;
      }
      setPwaPreference(value);
      setEnabledState(value);
    },
    [canToggle],
  );

  const value = useMemo<PwaPreferenceContextValue>(
    () => ({
      enabled,
      canToggle,
      setEnabled,
    }),
    [enabled, canToggle, setEnabled],
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

