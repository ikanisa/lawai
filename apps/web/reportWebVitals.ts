import type { NextWebVitalsMetric } from 'next/app';
import { DEMO_ORG_ID, DEMO_USER_ID } from './src/lib/api';

import { clientEnv } from './src/env.client';

const API_BASE = clientEnv.NEXT_PUBLIC_API_BASE_URL;

function sendTelemetry(body: Record<string, unknown>) {
  const url = `${API_BASE}/telemetry`;
  const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    navigator.sendBeacon(url, blob);
    return;
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch((error) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('web_vitals_telemetry_failed', error);
    }
  });
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  const navigationEntry =
    typeof performance !== 'undefined'
      ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)
      : undefined;
  const connection = (navigator as unknown as { connection?: Record<string, unknown> } | undefined)?.connection ?? null;
  const delta = 'delta' in metric ? (metric as { delta: number }).delta : null;
  const rating = 'rating' in metric ? (metric as { rating: string }).rating : null;

  sendTelemetry({
    orgId: DEMO_ORG_ID,
    userId: DEMO_USER_ID,
    eventName: 'web_vital',
    payload: {
      metric: metric.name,
      id: metric.id,
      value: metric.value,
      delta,
      rating,
      navigationType: navigationEntry?.type ?? null,
      connection,
    },
  });
}
