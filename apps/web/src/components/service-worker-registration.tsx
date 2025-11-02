'use client';

import { useEffect } from 'react';
import { useServiceWorker } from '../hooks/use-service-worker';

export function ServiceWorkerRegistration() {
  const { updateAvailable, registration } = useServiceWorker();

  useEffect(() => {
    if (updateAvailable && registration?.waiting) {
      // Auto-update in admin console for seamless experience
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [updateAvailable, registration]);

  return null;
}
