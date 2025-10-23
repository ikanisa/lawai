import { describe, expect, it } from 'vitest';
import {
  buildReportLink,
  formatTransparencyDigest,
  formatCount,
  formatDuration,
  formatPercent,
  summariseTransparencyReport,
  type TransparencyReport,
} from '../src/transparency.js';

describe('transparency helpers', () => {
  const baseReport: TransparencyReport = {
    id: 'report-1',
    org_id: 'org-1',
    period_start: '2024-04-01',
    period_end: '2024-04-30',
    generated_at: '2024-05-01T00:00:00.000Z',
    distribution_status: 'published',
    metrics: {
      operations: {
        totalRuns: 12,
        hitlTriggered: 3,
        hitl: { medianResponseMinutes: 42 },
      },
      compliance: { cepejPassRate: 0.875 },
      ingestion: { total: 50, succeeded: 49 },
      evaluations: { passRate: 0.92 },
    },
  };

  it('formats numbers consistently', () => {
    expect(formatCount(null)).toBe(0);
    expect(formatCount(4.6)).toBe(5);
    expect(formatDuration(15.2)).toBe('15,2 min');
    expect(formatPercent(0.875)).toBe('87,5%');
  });

  it('builds transparency report links with encoding', () => {
    const link = buildReportLink({ ...baseReport, org_id: 'org/with space' });
    expect(link).toBe('https://docs.avocat-ai.example/transparency-reports/org%2Fwith%20space/report-1');
  });

  it('summarises a report into markdown bullet', () => {
    const summary = summariseTransparencyReport(baseReport);
    expect(summary).toContain('runs 12');
    expect(summary).toContain('CEPEJ 87,5%');
    expect(summary).toContain('ingestion 49/50');
  });

  it('formats a digest for empty reports', () => {
    const reference = new Date('2024-05-02T00:00:00.000Z');
    const digest = formatTransparencyDigest(reference, []);
    expect(digest.summary).toBe('Aucun rapport de transparence généré durant la période couverte.');
    expect(digest.markdown).toContain('Bulletin de transparence (2024-05-02)');
  });

  it('formats a digest with multiple reports', () => {
    const reference = new Date('2024-05-02T00:00:00.000Z');
    const digest = formatTransparencyDigest(reference, [baseReport, baseReport]);
    expect(digest.summary).toBe('Synthèse de 2 rapport(s) de transparence.');
    expect(digest.markdown.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(2);
  });
});
