'use client';

import { useEffect } from 'react';
import { Workbox } from 'workbox-window';

export function ServiceWorkerManager() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const register = async () => {
      if (process.env.NODE_ENV === 'development') {
        await navigator.serviceWorker.register('/sw.js');
        return;
      }

      const wb = new Workbox('/sw.js');
      wb.addEventListener('waiting', () => {
        wb.messageSkipWaiting();
      });
      wb.addEventListener('controlling', () => {
        window.location.reload();
      });
      await wb.register();
    };

    register().catch((error) => {
      console.error('[pwa] failed to register service worker', error);
    });
  }, []);

  return null;
}
