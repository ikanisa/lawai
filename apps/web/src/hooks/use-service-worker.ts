'use client';

import { useEffect, useState } from 'react';

interface ServiceWorkerState {
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  isOnline: boolean;
}

export function useServiceWorker(): ServiceWorkerState {
  const [state, setState] = useState<ServiceWorkerState>({
    registration: null,
    updateAvailable: false,
    isOnline: true,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Track online/offline status
    const handleOnlineStatus = () => {
      setState((prev) => ({ ...prev, isOnline: navigator.onLine }));
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    handleOnlineStatus();

    // Register service worker
    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        setState((prev) => ({ ...prev, registration: reg }));

        // Handle updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setState((prev) => ({ ...prev, updateAvailable: true }));
            }
          });
        });

        // Periodic update checks
        setInterval(() => {
          reg.update().catch(() => {
            // Silent fail
          });
        }, 60 * 60 * 1000); // Every hour
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
      }
    };

    // Wait for page load
    if (document.readyState === 'complete') {
      void registerSW();
    } else {
      window.addEventListener('load', () => void registerSW(), { once: true });
    }

    // Handle controller change
    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return state;
}
