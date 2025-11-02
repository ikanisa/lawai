/* eslint-disable no-underscore-dangle */
/* global self, importScripts */

// Import Workbox from CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

if (self.workbox) {
  console.log('[PWA] Workbox loaded successfully');

  const { core, precaching, routing, strategies, expiration, cacheableResponse } = self.workbox;

  // Configuration
  const CACHE_VERSION = 'v1';
  const OFFLINE_URL = '/offline.html';
  const OFFLINE_CACHE_NAME = `offline-${CACHE_VERSION}`;

  // Immediate activation
  core.skipWaiting();
  core.clientsClaim();

  // Clean up old caches
  core.setCacheNameDetails({
    prefix: 'avocat-ai',
    suffix: CACHE_VERSION,
    precache: 'precache',
    runtime: 'runtime',
  });

  // Precache critical assets
  const precacheManifest = [
    { url: OFFLINE_URL, revision: '1.0.0' },
    { url: '/manifest.json', revision: '1.0.0' },
  ];

  precaching.precacheAndRoute(precacheManifest);

  // Navigation requests - App Shell pattern with offline fallback
  routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new strategies.NetworkFirst({
      cacheName: 'app-shell',
      networkTimeoutSeconds: 3,
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24, // 24 hours
        }),
      ],
    })
  );

  // Static assets (JS, CSS, fonts) - Stale While Revalidate
  routing.registerRoute(
    ({ request }) => ['style', 'script', 'font'].includes(request.destination),
    new strategies.StaleWhileRevalidate({
      cacheName: 'static-assets',
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        }),
      ],
    })
  );

  // Images - Cache First with expiration
  routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new strategies.CacheFirst({
      cacheName: 'images',
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        }),
      ],
    })
  );

  // API requests - Network First with short timeout
  routing.registerRoute(
    ({ url }) =>
      url.origin === self.location.origin &&
      url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/api/upload'),
    new strategies.NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 5,
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 60 * 5, // 5 minutes
        }),
      ],
    })
  );

  // Upload endpoints - Network Only (never cache)
  routing.registerRoute(
    ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/upload'),
    new strategies.NetworkOnly()
  );

  // External resources (CDN) - Cache First
  routing.registerRoute(
    ({ url, request }) =>
      url.origin !== self.location.origin &&
      ['style', 'script', 'font', 'image'].includes(request.destination),
    new strategies.CacheFirst({
      cacheName: 'cdn-assets',
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        }),
      ],
    })
  );

  // Catch handler for offline navigation
  routing.setCatchHandler(async ({ event }) => {
    if (event.request.mode === 'navigate') {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const cachedResponse = await cache.match(OFFLINE_URL);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    return Response.error();
  });

  // Message handler for SKIP_WAITING
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });

  // Push notification support
  self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {};
    const title = data.title ?? 'Avocat-AI';
    const body = data.body ?? 'Nouvelle notification juridique';
    const options = {
      body,
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      tag: data.tag ?? 'avocat-ai-notification',
      data: data.url ? { url: data.url } : undefined,
      vibrate: [200, 100, 200],
      requireInteraction: false,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  });

  // Notification click handler
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url ?? '/workspace';

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        // Check if there's already a window/tab open
        for (const client of clients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if none exists
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
    );
  });

  console.log('[PWA] Service worker initialized successfully');
} else {
  console.error('[PWA] Workbox failed to load');
}
