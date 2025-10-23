'use client';

import { Workbox } from 'workbox-window';

const DIGEST_KEY = 'avocat-ai-digest-enabled';
const PWA_FLAG_KEY = 'NEXT_PUBLIC_ENABLE_PWA';
const PWA_CONSENT_KEY = 'avocat-ai.pwa.consent';
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

export function hasPwaConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PWA_CONSENT_KEY) === 'true';
  } catch (error) {
    console.warn('pwa_consent_read_failed', error);
    return false;
  }
}

export function grantPwaConsent() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PWA_CONSENT_KEY, 'true');
  } catch (error) {
    console.warn('pwa_consent_write_failed', error);
  }
}

export function revokePwaConsent() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PWA_CONSENT_KEY);
  } catch (error) {
    console.warn('pwa_consent_revoke_failed', error);
  }
}

export function canRegisterPwaWithoutStoredConsent(): boolean {
  if (typeof window === 'undefined') return false;
  const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const hasNotifications = 'Notification' in window;
  return hasServiceWorker && !hasNotifications;
}

export function registerPwa(): Promise<ServiceWorkerRegistration | null> {
  if (!isPwaFeatureEnabled()) {
    registrationPromise = null;
    return Promise.resolve(null);
  }

  if (typeof window === 'undefined') {
    console.warn('pwa_registration_skipped', { reason: 'window_unavailable' });
    return Promise.resolve(null);
  }

  if (!hasPwaConsent()) {
    if (canRegisterPwaWithoutStoredConsent()) {
      grantPwaConsent();
    } else {
      return Promise.resolve(null);
    }
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('pwa_registration_unsupported_browser', {
      reason: 'service_worker_unavailable',
    });
    return Promise.resolve(null);
  }

  if (!registrationPromise) {
    const wb = new Workbox('/sw.js', { scope: '/' });
    wb.addEventListener('waiting', () => {
      wb.messageSW({ type: 'SKIP_WAITING' }).catch(() => undefined);
    });
    registrationPromise = wb.register().catch((error) => {
      console.error('sw_register_failed', error);
      registrationPromise = null;
      throw error;
    });
  }

  return registrationPromise;
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

  grantPwaConsent();

  if (!registrationPromise) {
    try {
      await registerPwa();
    } catch (error) {
      console.warn('digest_sw_register_failed', error);
      return false;
    }
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
