'use client';

import { Workbox } from 'workbox-window';

import { clientEnv } from '../env.client';

const DIGEST_KEY = 'avocat-ai-digest-enabled';
export const PWA_OPT_IN_STORAGE_KEY = 'avocat-ai.install.optIn';

type NotificationLike = {
  requestPermission: () => Promise<NotificationPermission>;
  permission?: NotificationPermission;
};

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;
let cachedConsent: boolean | null = null;

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined';
}

function getNavigator(): Navigator | null {
  const globalNavigator = (globalThis as typeof globalThis & { navigator?: Navigator }).navigator;
  if (globalNavigator) {
    return globalNavigator;
  }

  if (!isBrowserEnvironment()) {
    return null;
  }

  return window.navigator ?? null;
}

function getNotification(): NotificationLike | null {
  if (!isBrowserEnvironment()) {
    return null;
  }

  const windowNotification = (window as typeof window & { Notification?: NotificationLike }).Notification;
  if (windowNotification) {
    return windowNotification;
  }

  const globalNotification = (globalThis as typeof globalThis & { Notification?: NotificationLike }).Notification;
  return globalNotification ?? null;
}

function getNotificationPermission(): NotificationPermission | 'unsupported' {
  const notification = getNotification();
  if (!notification) {
    return 'unsupported';
  }
  return notification.permission ?? 'default';
}

function readOptInPreference(): boolean {
  if (!isBrowserEnvironment()) {
    return false;
  }

  try {
    return window.localStorage.getItem(PWA_OPT_IN_STORAGE_KEY) === 'true';
  } catch (error) {
    console.warn('pwa_preference_read_failed', error);
    return false;
  }
}

function writeOptInPreference(value: boolean): void {
  if (!isBrowserEnvironment()) {
    return;
  }

  try {
    window.localStorage.setItem(PWA_OPT_IN_STORAGE_KEY, value ? 'true' : 'false');
  } catch (error) {
    console.warn('pwa_preference_write_failed', error);
  }
}

function getFeatureFlagValue(): boolean {
  const override = process.env.NEXT_PUBLIC_ENABLE_PWA;
  if (override === undefined) {
    return clientEnv.NEXT_PUBLIC_ENABLE_PWA;
  }
  return override !== 'false';
}

function ensureFeatureEnabled(): boolean {
  const enabled = getFeatureFlagValue();
  if (!enabled) {
    registrationPromise = null;
  }
  return enabled;
}

export function isPwaFeatureEnabled(): boolean {
  return ensureFeatureEnabled();
}

export function isPwaEnvEnabled(): boolean {
  return ensureFeatureEnabled();
}

export function isPwaSupported(): boolean {
  const navigatorInstance = getNavigator();
  return Boolean(navigatorInstance && 'serviceWorker' in navigatorInstance);
}

export function getPwaOptInPreference(): boolean {
  if (cachedConsent === null) {
    cachedConsent = readOptInPreference();
  }
  return cachedConsent;
}

export const getPwaPreference = getPwaOptInPreference;

export function setPwaOptInPreference(enabled: boolean): void {
  cachedConsent = enabled;
  writeOptInPreference(enabled);
}

export function setPwaPreference(enabled: boolean): void {
  setPwaOptInPreference(enabled);
}

export function grantPwaConsent(): void {
  setPwaOptInPreference(true);
}

export function revokePwaConsent(): void {
  setPwaOptInPreference(false);
}

export function hasPwaConsent(): boolean {
  return getPwaOptInPreference();
}

export function canRegisterPwaWithoutStoredConsent(): boolean {
  if (!isBrowserEnvironment()) {
    return false;
  }

  if (!getFeatureFlagValue()) {
    return false;
  }

  if (!isPwaSupported()) {
    return false;
  }

  if (hasPwaConsent()) {
    return true;
  }

  const permission = getNotificationPermission();
  if (permission === 'unsupported') {
    return true;
  }

  return permission === 'granted';
}

export function registerPwa(): Promise<ServiceWorkerRegistration> | null {
  if (!ensureFeatureEnabled()) {
    console.info('pwa_registration_skipped', { reason: 'environment_disabled' });
    return null;
  }

  if (!isBrowserEnvironment()) {
    console.info('pwa_registration_skipped', { reason: 'server_environment' });
    return null;
  }

  if (!isPwaSupported()) {
    console.warn('pwa_registration_unsupported_browser', { reason: 'service_worker_unavailable' });
    return null;
  }

  if (!hasPwaConsent()) {
    if (canRegisterPwaWithoutStoredConsent()) {
      grantPwaConsent();
    } else {
      console.info('pwa_registration_deferred', { reason: 'consent_required' });
      return null;
    }
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
  if (!getFeatureFlagValue()) {
    return false;
  }

  if (!isBrowserEnvironment()) {
    return false;
  }

  try {
    return window.localStorage.getItem(DIGEST_KEY) === 'true';
  } catch (error) {
    console.warn('digest_preference_read_failed', error);
    return false;
  }
}

export async function enableDigestNotifications(): Promise<boolean> {
  if (!ensureFeatureEnabled()) {
    return false;
  }

  if (!hasPwaConsent()) {
    console.info('digest_notification_skipped', { reason: 'pwa_consent_required' });
    return false;
  }

  if (!isBrowserEnvironment()) {
    return false;
  }

  const notification = getNotification();
  if (!notification) {
    console.warn('pwa_digest_unsupported');
    return false;
  }

  let permission: NotificationPermission;
  try {
    permission = await notification.requestPermission();
  } catch (error) {
    console.warn('digest_notification_permission_failed', error);
    return false;
  }

  if (permission !== 'granted') {
    return false;
  }

  grantPwaConsent();

  const navigatorInstance = getNavigator();
  if (!navigatorInstance?.serviceWorker) {
    console.warn('digest_notification_failed', 'service_worker_unavailable');
    return false;
  }

  const activeRegistration = registerPwa();
  if (!activeRegistration) {
    console.warn('digest_notification_failed', 'pwa_registration_unavailable');
    return false;
  }

  try {
    const registration = await activeRegistration;
    await registration.showNotification('Avocat-AI Francophone', {
      body: 'Les alertes de veille juridique seront envoyées ici.',
      tag: 'avocat-ai-digest-preview',
      renotify: false,
    });
    writeOptInPreference(true);
    try {
      window.localStorage.setItem(DIGEST_KEY, 'true');
    } catch (error) {
      console.warn('digest_preference_write_failed', error);
    }
    return true;
  } catch (error) {
    console.error('digest_notification_failed', error);
    return false;
  }
}
