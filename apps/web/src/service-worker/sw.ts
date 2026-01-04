/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

clientsClaim();
cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

const appShellHandler = createHandlerBoundToURL('/');

registerRoute(
  new NavigationRoute(appShellHandler, {
    allowlist: [/^\/[^.]*$/],
  }),
);

registerRoute(
  ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'static-assets',
  }),
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/official'),
  new NetworkFirst({
    cacheName: 'official-law',
    networkTimeoutSeconds: 3,
  }),
);

registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/uploads'),
  new NetworkFirst({
    cacheName: 'uploads',
  }),
);

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'Avocat AI updates';
  const body = data.body ?? 'New legal intelligence is available.';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: data.tag ?? 'avocat-ai-digest',
      data: data.url ? { url: data.url } : undefined,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  const targetUrl = event.notification.data?.url;
  event.notification.close();
  if (targetUrl) {
    event.waitUntil(self.clients.openWindow(targetUrl));
  }
});
