'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';

interface UseServiceWorkerReturn {
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  isOnline: boolean;
  update: () => void;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Track online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker
    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        setRegistration(reg);

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
              toast({
                title: 'Mise à jour disponible',
                description: 'Une nouvelle version est disponible. Rechargez pour l\'activer.',
                action: (
                  <ToastAction
                    altText="Mettre à jour"
                    onClick={() => {
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }}
                  >
                    Mettre à jour
                  </ToastAction>
                ),
              });
            }
          });
        });

        // Check for updates periodically
        setInterval(() => {
          reg.update().catch(() => {
            // Silent fail
          });
        }, 60 * 60 * 1000); // Check every hour
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
      }
    };

    if (document.readyState === 'complete') {
      void registerSW();
    } else {
      window.addEventListener('load', () => void registerSW(), { once: true });
    }

    // Handle controller change (new SW activated)
    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const update = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return { registration, updateAvailable, isOnline, update };
}
