/* eslint-disable no-underscore-dangle */
/* global self */
importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");

if (self.workbox) {
  const { core, precaching, routing, strategies, expiration } = self.workbox;
  const OFFLINE_URL = "/offline.html";
  const precacheManifest = (self.__WB_MANIFEST || []).concat({ url: OFFLINE_URL, revision: "1" });

  core.skipWaiting();
  core.clientsClaim();

  precaching.precacheAndRoute(precacheManifest);

  routing.registerRoute(
    ({ request }) => request.mode === "navigate",
    new strategies.StaleWhileRevalidate({ cacheName: "app-shell" })
  );

  routing.registerRoute(
    ({ request }) => ["style", "script", "font"].includes(request.destination),
    new strategies.StaleWhileRevalidate({ cacheName: "static-assets" })
  );

  routing.registerRoute(
    ({ url }) =>
      url.origin === self.location.origin &&
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/upload"),
    new strategies.NetworkFirst({ cacheName: "law-pages", networkTimeoutSeconds: 3 })
  );

  routing.registerRoute(
    ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/api/upload"),
    new strategies.NetworkOnly()
  );

  routing.registerRoute(
    ({ url, request }) =>
      url.origin !== self.location.origin &&
      ["style", "script", "font", "image"].includes(request.destination),
    new strategies.CacheFirst({
      cacheName: "cdn-assets",
      plugins: [
        new expiration.ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 })
      ]
    })
  );

  routing.setCatchHandler(async ({ event }) => {
    if (event.request.mode === "navigate") {
      const cached = await precaching.matchPrecache(OFFLINE_URL);
      if (cached) {
        return cached;
      }
    }
    return Response.error();
  });

  self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
      self.skipWaiting();
    }
  });
}
