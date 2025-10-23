'use client';

import { Workbox } from 'workbox-window';
import { clientEnv } from '../env.client';

const DIGEST_KEY = 'avocat-ai-digest-enabled';
export const PWA_OPT_IN_STORAGE_KEY = 'avocat-ai.install.optIn';

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;
let preferenceCache: boolean | null = null;

export function isPwaGloballyEnabled(): boolean {
  return pwaGloballyEnabled;
}

export function isPwaSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'serviceWorker' in navigator;
}

function readPreferenceFromStorage(): boolean {
  if (!pwaGloballyEnabled) {
    preferenceCache = false;
    return false;
  }

  if (preferenceCache !== null) {
    return preferenceCache;
  }

  if (typeof window === 'undefined') {
    preferenceCache = pwaGloballyEnabled;
    return preferenceCache;
  }

  try {
    const stored = window.localStorage.getItem(PWA_PREFERENCE_STORAGE_KEY);
    if (stored === 'disabled') {
      preferenceCache = false;
      return false;
    }
    if (stored === 'enabled') {
      preferenceCache = true;
      return true;
    }
  } catch (error) {
    console.warn('pwa_preference_read_failed', error);
  }

  preferenceCache = pwaGloballyEnabled;
  return preferenceCache;
}

export function getPwaPreference(): boolean {
  return readPreferenceFromStorage();
}

export function setPwaPreference(enabled: boolean) {
  preferenceCache = enabled && pwaGloballyEnabled;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!pwaGloballyEnabled) {
      window.localStorage.removeItem(PWA_PREFERENCE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PWA_PREFERENCE_STORAGE_KEY, preferenceCache ? 'enabled' : 'disabled');
  } catch (error) {
    console.warn('pwa_preference_write_failed', error);
  }
}

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

  if (!isPwaSupported()) {
    if (typeof window !== 'undefined') {
      console.warn('pwa_unsupported_browser');
    }
    return;
  }

  if (!getPwaPreference()) {
    return;
  }

  try {
    window.localStorage.setItem(PWA_OPT_IN_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.warn('pwa_opt_in_write_failed', error);
  }
}

export function registerPwa(): Promise<ServiceWorkerRegistration> | null {
  if (!isPwaFeatureEnabled()) {
    console.info('pwa_registration_skipped', { reason: 'environment_disabled' });
    return null;
  }

  if (!getPwaOptInPreference()) {
    console.info('pwa_registration_deferred', { reason: 'preference_opt_out' });
    return null;
  }

  if (!isBrowserEnvironment()) {
    return null;
  }

  if (!('serviceWorker' in navigator)) {
    console.info('pwa_registration_skipped', { reason: 'unsupported_browser' });
    return null;
  }

  if (!registrationPromise) {
    const wb = new Workbox('/sw.js', { scope: '/' });
    wb.addEventListener('waiting', () => {
      wb.messageSW({ type: 'SKIP_WAITING' }).catch(() => undefined);
    });
    registrationPromise = wb
      .register()
      .catch((error) => {
        console.error('sw_register_failed', error);
        registrationPromise = null;
        throw error;
      });
  }

  return registrationPromise;
}

export function isDigestEnabled(): boolean {
  if (!pwaGloballyEnabled || typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(DIGEST_KEY) === 'true';
}

export async function enableDigestNotifications(): Promise<boolean> {
  if (!pwaGloballyEnabled) {
    return false;
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (!isPwaSupported()) {
    console.warn('pwa_digest_unsupported');
    return false;
  }

  setPwaPreference(true);

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return false;
  }

  setPwaPreference(true);

  if (!registrationPromise) {
    const result = registerPwa();
    if (!result) {
      console.warn('digest_notification_failed', 'pwa_registration_unavailable');
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
