import { useCallback, useEffect, useState } from 'react';

export type ReadingMode = 'research' | 'brief' | 'evidence';

const STORAGE_KEY = 'avocat-reading-mode';
const DEFAULT_MODE: ReadingMode = 'research';

function loadInitialMode(): ReadingMode {
  if (typeof window === 'undefined') {
    return DEFAULT_MODE;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_MODE;
    }
    if (stored === 'research' || stored === 'brief' || stored === 'evidence') {
      return stored;
    }
    return DEFAULT_MODE;
  } catch (error) {
    console.warn('reading_mode_load_failed', error);
    return DEFAULT_MODE;
  }
}

export function useReadingMode() {
  const [mode, setModeState] = useState<ReadingMode>(() => loadInitialMode());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch (error) {
      console.warn('reading_mode_persist_failed', error);
    }
  }, [mode]);

  const setMode = useCallback((next: ReadingMode) => {
    setModeState(next);
  }, []);

  return { mode, setMode } as const;
}

