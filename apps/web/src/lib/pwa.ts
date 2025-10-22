'use client';

const DIGEST_KEY = 'avocat-ai-digest-enabled';
let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

export const PWA_REGISTRATION_EVENT = 'pwa:register';

async function loadWorkbox(): Promise<typeof import('workbox-window')> {
  return import('workbox-window');
}

export async function registerPwa(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  if (!registrationPromise) {
    registrationPromise = loadWorkbox()
      .then(({ Workbox }) => {
        const wb = new Workbox('/sw.js', { scope: '/' });
        wb.addEventListener('waiting', () => {
          wb.messageSW({ type: 'SKIP_WAITING' }).catch(() => undefined);
        });
        return wb.register();
      })
      .catch((error) => {
        console.error('sw_register_failed', error);
        registrationPromise = null;
        throw error;
      });
  }

  try {
    return await registrationPromise;
  } catch (error) {
    return null;
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

  await registerPwa();

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
