import type { ReportHandler } from 'web-vitals';
import { API_BASE, getActiveOrgId, getActiveUserId } from '../src/lib/api';

const ENDPOINT = `${API_BASE}/metrics/web-vitals`;

function sendMetric(body: Record<string, unknown>) {
  try {
    const orgId = getActiveOrgId();
    const userId = getActiveUserId();
    if (!orgId || !userId) {
      return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-org-id': orgId,
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch (error) {
    console.warn('web_vitals_send_failed', error);
  }
}

export const reportWebVitals: ReportHandler = (metric) => {
  if (typeof window === 'undefined') {
    return;
  }

  const locale = document.documentElement?.lang ?? 'fr';
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

  const body = {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    delta: 'delta' in metric && typeof metric.delta === 'number' ? metric.delta : 0,
    label: 'label' in metric ? metric.label : 'web-vital',
    rating: 'rating' in metric ? metric.rating : undefined,
    page: window.location.pathname,
    locale,
    navigationType: navigation?.type ?? undefined,
  } satisfies Record<string, unknown>;

  sendMetric(body);
};
