'use client';

import { Workbox } from 'workbox-window';

const DIGEST_KEY = 'avocat-ai-digest-enabled';
export const PWA_OPT_IN_STORAGE_KEY = 'avocat-ai.install.optIn';

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

export function isPwaEnvEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_ENABLE_PWA;
  return flag === undefined || flag === 'true';
}

export function getPwaPreference(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(PWA_OPT_IN_STORAGE_KEY) === 'true';
  } catch (error) {
    console.warn('pwa_preference_read_failed', error);
    return false;
  }
}

export function setPwaPreference(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(PWA_OPT_IN_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.warn('pwa_preference_write_failed', error);
  }
}

export function isPwaSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const nav = window.navigator;
  return Boolean(nav && 'serviceWorker' in nav);
}

export function registerPwa() {
  if (!isPwaEnvEnabled()) {
    console.info('pwa_registration_skipped', { reason: 'env_disabled' });
    return;
  }

  if (typeof window === 'undefined') {
    console.info('pwa_registration_skipped', { reason: 'ssr' });
    return;
  }

  if (!isPwaSupported()) {
    console.warn('pwa_unsupported_browser');
    return;
  }

  if (!getPwaPreference()) {
    console.info('pwa_registration_skipped', { reason: 'user_opt_out' });
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

  setPwaPreference(true);

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
