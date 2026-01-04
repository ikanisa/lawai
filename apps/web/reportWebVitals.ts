import type { NextWebVitalsMetric } from 'next/app';
import { DEMO_ORG_ID, DEMO_USER_ID } from './src/lib/api';
import { getCachedSession, waitForSession, type SessionValue } from '@avocat-ai/auth';
import { API_BASE } from './src/lib/constants';
import { ensureCsrfToken, withCsrf } from './src/lib/security';

async function sendTelemetry(body: Record<string, unknown>) {
  const token = await ensureCsrfToken().catch(() => null);
  const targetUrl = token ? `${API_BASE}/telemetry?csrf=${encodeURIComponent(token)}` : `${API_BASE}/telemetry`;
  const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator && token) {
    navigator.sendBeacon(targetUrl, blob);
    return;
  }
  try {
    const init = await withCsrf({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: 'include',
    });
    void fetch(targetUrl, init).catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('web_vitals_telemetry_failed', error);
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('web_vitals_telemetry_failed', error);
    }
  }
}

let cachedSession: SessionValue | null | undefined;

async function ensureSession(): Promise<SessionValue | null> {
  if (cachedSession !== undefined) {
    return cachedSession;
  }
  const existing = getCachedSession();
  if (existing && existing.orgId && existing.userId) {
    cachedSession = existing;
    return existing;
  }
  const resolved = await waitForSession();
  if (resolved && resolved.orgId && resolved.userId) {
    cachedSession = resolved;
    return resolved;
  }
  cachedSession = null;
  return null;
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  void (async () => {
    const session = await ensureSession();
    if (!session) {
      return;
    }
    const navigationEntry =
      typeof performance !== 'undefined'
        ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)
        : undefined;
    const connection =
      (navigator as unknown as { connection?: Record<string, unknown> } | undefined)?.connection ?? null;
    const delta = 'delta' in metric ? (metric as { delta: number }).delta : null;
    const rating = 'rating' in metric ? (metric as { rating: string }).rating : null;

    void sendTelemetry({
      orgId: session.orgId ?? DEMO_ORG_ID,
      userId: session.userId ?? DEMO_USER_ID,
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
  })();
}
