/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL, matchPrecache, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { enable } from 'workbox-navigation-preload';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string }>; };

const FALLBACK_URL = '/offline.html';

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
enable();

precacheAndRoute(self.__WB_MANIFEST);

const appShellHandler = createHandlerBoundToURL('/');

registerRoute(
  new NavigationRoute(async (options) => {
    try {
      const response = await appShellHandler(options);
      if (response) {
        return response;
      }
      throw new Error('No response from app shell');
    } catch (error) {
      const fallback = await matchPrecache(FALLBACK_URL);
      return fallback ?? Response.error();
    }
  }),
);

registerRoute(
  ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  }),
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api'),
  new NetworkFirst({
    cacheName: 'api',
    networkTimeoutSeconds: 3,
  }),
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open('offline-fallback');
      await cache.add(new Request(FALLBACK_URL, { cache: 'reload' }));
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    return;
  }

  if (event.request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }

          return await fetch(event.request);
        } catch (error) {
          const cache = await caches.open('offline-fallback');
          const cachedResponse = await cache.match(FALLBACK_URL);
          return cachedResponse ?? Response.error();
        }
      })(),
    );
  }
});
