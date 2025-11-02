"use client";

import { useServiceWorker } from "./use-service-worker";

export function ServiceWorkerBridge() {
  // This component automatically registers the service worker
  // and handles updates via the useServiceWorker hook
  useServiceWorker();

  return null;
}
