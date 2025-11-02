import type { ReportHandler } from 'web-vitals';
import { DEMO_ORG_ID, DEMO_USER_ID } from '../src/lib/api';
import { API_BASE } from '../src/lib/constants';
import { withCsrf } from '../src/lib/security';

const ENDPOINT = `${API_BASE}/metrics/web-vitals`;

async function sendMetric(body: Record<string, unknown>) {
  try {
    const init = await withCsrf({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': DEMO_USER_ID,
        'x-org-id': DEMO_ORG_ID,
      },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: 'include',
    });
    void fetch(ENDPOINT, init);
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

  void sendMetric(body);
};
