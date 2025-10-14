import { beforeEach, describe, expect, it } from 'vitest';
import { __resetWebVitalsForTests, listWebVitals, recordWebVital } from '../src/metrics';

function buildRecord(id: string, orgId: string, userId: string) {
  return {
    id,
    name: 'LCP',
    value: 1800,
    delta: 12,
    label: 'web-vital',
    rating: 'good' as const,
    page: '/research',
    locale: 'fr',
    navigationType: 'navigate',
    userAgent: 'jest',
    orgId,
    userId,
  };
}

describe('metrics web vitals store', () => {
  beforeEach(() => {
    __resetWebVitalsForTests();
  });

  it('keeps the most recent 200 records per org', () => {
    for (let index = 0; index < 206; index += 1) {
      recordWebVital(buildRecord(`metric-${index}`, 'org-1', 'user-1'));
    }

    const metrics = listWebVitals('org-1', 500);
    expect(metrics).toHaveLength(200);
    expect(metrics[0].id).toBe('metric-205');
    expect(metrics.at(-1)?.id).toBe('metric-6');
  });

  it('does not include other org records when listing', () => {
    recordWebVital(buildRecord('metric-1', 'org-1', 'user-1'));
    recordWebVital(buildRecord('metric-2', 'org-2', 'user-2'));

    const metrics = listWebVitals('org-1', 10);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].orgId).toBe('org-1');
  });
});
