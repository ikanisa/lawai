'use client';

import { Workbox } from 'workbox-window';

const DIGEST_KEY = 'avocat-ai-digest-enabled';
const PWA_FLAG_KEY = 'NEXT_PUBLIC_ENABLE_PWA';
let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

function readPwaFlag(): string | undefined {
  const envFromProcess =
    typeof process !== 'undefined' ? process.env?.[PWA_FLAG_KEY] : undefined;
  if (typeof envFromProcess === 'string') {
    return envFromProcess;
  }

  const globalEnv = (globalThis as { __env?: Record<string, string | undefined> }).__env;
  return globalEnv?.[PWA_FLAG_KEY];
}

function toBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return false;
}

export function isPwaFeatureEnabled(): boolean {
  return toBooleanFlag(readPwaFlag());
}

export function registerPwa() {
  if (!isPwaFeatureEnabled()) {
    registrationPromise = null;
    return;
  }

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  if (!registrationPromise) {
    const wb = new Workbox('/sw.js', { scope: '/' });
    wb.addEventListener('waiting', () => {
      wb.messageSW({ type: 'SKIP_WAITING' }).catch(() => undefined);
    });
    registrationPromise = wb.register().catch((error) => {
      console.error('sw_register_failed', error);
      throw error;
    });
  }
}

export function isDigestEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DIGEST_KEY) === 'true';
}

export async function enableDigestNotifications(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return false;
  }

  if (!registrationPromise) {
    registerPwa();
  }

  try {
    const registration = await (registrationPromise ?? navigator.serviceWorker.ready);
    await registration.showNotification('Avocat-AI Francophone', {
      body: 'Les alertes de veille juridique seront envoyées ici.',
      tag: 'avocat-ai-digest-preview',
      renotify: false,
    });
    window.localStorage.setItem(DIGEST_KEY, 'true');
    return true;
  } catch (error) {
    console.error('digest_notification_failed', error);
    return false;
  }
}
