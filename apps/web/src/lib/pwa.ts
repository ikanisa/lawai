'use client';

import { Workbox } from 'workbox-window';
import { clientEnv } from '../env.client';

const DIGEST_KEY = 'avocat-ai-digest-enabled';
export const PWA_OPT_IN_STORAGE_KEY = 'avocat-ai.pwa.opt-in';

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;
let optInCache: boolean | null = null;

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined';
}

export function isPwaFeatureEnabled(): boolean {
  return Boolean(clientEnv.NEXT_PUBLIC_ENABLE_PWA);
}

export function getPwaOptInPreference(): boolean {
  if (!isBrowserEnvironment()) {
    return optInCache ?? false;
  }

  try {
    const stored = window.localStorage.getItem(PWA_OPT_IN_STORAGE_KEY);
    optInCache = stored === 'true';
    return optInCache;
  } catch (error) {
    console.warn('pwa_opt_in_read_failed', error);
    optInCache = false;
    return false;
  }
}

export function setPwaOptInPreference(enabled: boolean): void {
  optInCache = enabled;

  if (!isBrowserEnvironment()) {
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
  if (!isBrowserEnvironment()) return false;

  try {
    return window.localStorage.getItem(DIGEST_KEY) === 'true';
  } catch (error) {
    console.warn('digest_pref_read_failed', error);
    return false;
  }
}

export async function enableDigestNotifications(): Promise<boolean> {
  if (!isPwaFeatureEnabled()) {
    console.info('digest_notifications_unavailable', { reason: 'pwa_disabled' });
    return false;
  }

  if (!isBrowserEnvironment()) {
    return false;
  }

  if (!('Notification' in window)) {
    console.info('digest_notifications_unavailable', { reason: 'notification_api_unavailable' });
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    console.info('digest_notifications_unavailable', { reason: 'service_worker_unsupported' });
    return false;
  }

  if (!getPwaOptInPreference()) {
    console.info('digest_notifications_unavailable', { reason: 'pwa_opt_in_required' });
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return false;
  }

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
