importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (self.workbox) {
  self.workbox.setConfig({ debug: false });

  self.workbox.core.clientsClaim();

  const { precaching, routing, strategies } = self.workbox;

  precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new strategies.StaleWhileRevalidate({ cacheName: 'app-shell' }),
  );

  routing.registerRoute(
    ({ request }) => ['style', 'script', 'font'].includes(request.destination),
    new strategies.StaleWhileRevalidate({ cacheName: 'static-assets' }),
  );

  routing.registerRoute(
    ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/official'),
    new strategies.NetworkFirst({ cacheName: 'official-law', networkTimeoutSeconds: 3 }),
  );

  routing.registerRoute(
    ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/uploads'),
    new strategies.NetworkOnly(),
  );

  self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {};
    const title = data.title ?? 'Veille juridique Avocat-AI';
    const body = data.body ?? 'Nouvelles mises à jour sont disponibles.';
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
}
