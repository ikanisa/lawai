"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

interface PwaInstallContextValue {
  shouldPrompt: boolean;
  isAvailable: boolean;
  registerSuccess: () => void;
  promptInstall: () => Promise<InstallOutcome>;
  dismissPrompt: () => void;
}

const RUN_THRESHOLD = 2;
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // one week
const STORAGE_KEYS = {
  count: 'avocat-ai.install.count',
  snoozeUntil: 'avocat-ai.install.snoozeUntil',
  installed: 'avocat-ai.install.installed',
};

const PwaInstallContext = createContext<PwaInstallContextValue | undefined>(undefined);

function readNumber(key: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (error) {
    console.warn('pwa_install_storage_read_failed', key, error);
    return 0;
  }
}

function writeNumber(key: string, value: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch (error) {
    console.warn('pwa_install_storage_write_failed', key, error);
  }
}

function clearKey(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn('pwa_install_storage_clear_failed', key, error);
  }
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    // @ts-expect-error – iOS Safari exposes navigator.standalone
    if (typeof window.navigator !== 'undefined' && window.navigator.standalone) {
      return true;
    }
  } catch (error) {
    console.warn('pwa_install_match_media_failed', error);
  }
  return false;
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [shouldPrompt, setShouldPrompt] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);

  const installedFlag = useMemo(() => readNumber(STORAGE_KEYS.installed) === 1, []);

  useEffect(() => {
    if (installedFlag || isStandaloneDisplay()) {
      setInstalled(true);
      writeNumber(STORAGE_KEYS.installed, 1);
    }
  }, [installedFlag]);

  const maybeShowPrompt = useCallback(
    (promptEvent: BeforeInstallPromptEvent | null = deferredPrompt) => {
      if (!promptEvent) return;
      if (installed) return;
      const snoozeUntil = readNumber(STORAGE_KEYS.snoozeUntil);
      if (snoozeUntil && snoozeUntil > Date.now()) {
        return;
      }
      const count = readNumber(STORAGE_KEYS.count);
      if (count >= RUN_THRESHOLD) {
        setShouldPrompt(true);
      }
    },
    [deferredPrompt, installed],
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setDeferredPrompt(promptEvent);
      setIsAvailable(true);
      maybeShowPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setShouldPrompt(false);
      setDeferredPrompt(null);
      setIsAvailable(false);
      writeNumber(STORAGE_KEYS.installed, 1);
      clearKey(STORAGE_KEYS.count);
      clearKey(STORAGE_KEYS.snoozeUntil);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      }
    };
  }, [maybeShowPrompt]);

  useEffect(() => {
    maybeShowPrompt();
  }, [maybeShowPrompt]);

  const registerSuccess = useCallback(() => {
    if (installed) return;
    const next = readNumber(STORAGE_KEYS.count) + 1;
    writeNumber(STORAGE_KEYS.count, next);
    if (deferredPrompt) {
      maybeShowPrompt(deferredPrompt);
    }
  }, [deferredPrompt, installed, maybeShowPrompt]);

  const dismissPrompt = useCallback(() => {
    setShouldPrompt(false);
    writeNumber(STORAGE_KEYS.snoozeUntil, Date.now() + SNOOZE_MS);
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt) {
      return 'unavailable';
    }

    try {
      await deferredPrompt.prompt();
    } catch (error) {
      console.warn('pwa_install_prompt_failed', error);
    }

    let outcome: 'accepted' | 'dismissed' | undefined;
    try {
      const choice = await deferredPrompt.userChoice;
      outcome = choice?.outcome;
    } catch (error) {
      console.warn('pwa_install_choice_failed', error);
    }

    setDeferredPrompt(null);
    setShouldPrompt(false);
    setIsAvailable(false);

    if (outcome === 'accepted') {
      setInstalled(true);
      writeNumber(STORAGE_KEYS.installed, 1);
      return 'accepted';
    }

    writeNumber(STORAGE_KEYS.snoozeUntil, Date.now() + SNOOZE_MS);
    return 'dismissed';
  }, [deferredPrompt]);

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      shouldPrompt: shouldPrompt && !installed,
      isAvailable: isAvailable && !installed,
      registerSuccess,
      promptInstall,
      dismissPrompt,
    }),
    [dismissPrompt, installed, isAvailable, promptInstall, registerSuccess, shouldPrompt],
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall(): PwaInstallContextValue {
  const context = useContext(PwaInstallContext);
  if (!context) {
    throw new Error('usePwaInstall must be used within a PwaInstallProvider');
  }
  return context;
}
