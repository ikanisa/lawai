export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

export interface WebVitalRecord {
  id: string;
  name: string;
  value: number;
  delta: number;
  label: string;
  rating: WebVitalRating;
  page: string;
  locale: string | null;
  navigationType: string | null;
  userAgent: string | null;
  orgId: string;
  userId: string;
  createdAt: string;
}

const MAX_RECORDS_PER_ORG = 200;
const MAX_STORE_SIZE = 500;

const webVitalStore: WebVitalRecord[] = [];

export function recordWebVital(
  input: Omit<WebVitalRecord, 'createdAt'> & { createdAt?: string },
): WebVitalRecord {
  const record: WebVitalRecord = {
    ...input,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  webVitalStore.unshift(record);

  let seenForOrg = 0;
  for (let index = 0; index < webVitalStore.length; index += 1) {
    const entry = webVitalStore[index];
    if (entry.orgId === record.orgId) {
      seenForOrg += 1;
      if (seenForOrg > MAX_RECORDS_PER_ORG) {
        webVitalStore.splice(index, 1);
        index -= 1;
        continue;
      }
    }
    if (index >= MAX_STORE_SIZE) {
      webVitalStore.splice(index);
      break;
    }
  }

  return record;
}

export function listWebVitals(orgId: string, limit = 50): WebVitalRecord[] {
  const safeLimit = Math.max(1, Math.min(limit, MAX_RECORDS_PER_ORG));
  const filtered = webVitalStore.filter((entry) => entry.orgId === orgId);
  return filtered.slice(0, safeLimit);
}

export function __resetWebVitalsForTests() {
  webVitalStore.length = 0;
}
