import { describe, expect, it } from 'vitest';
import { formatTransparencyDigest, type TransparencyDigestRecord } from '../src/transparency-digest.js';

describe('transparency digest formatting', () => {
  const baseReport: TransparencyDigestRecord = {
    id: 'r1',
    org_id: 'org-1',
    period_start: '2024-08-01',
    period_end: '2024-08-31',
    generated_at: '2024-09-01T10:00:00Z',
    distribution_status: 'published',
    metrics: {
      operations: {
        totalRuns: 42,
        hitlTriggered: 5,
        hitl: { medianResponseMinutes: 12 },
      },
      compliance: { cepejPassRate: 0.95 },
      ingestion: { total: 12, succeeded: 11 },
      evaluations: { passRate: 0.9 },
    },
  };

  it('produces markdown and summary for populated reports', () => {
    const reference = new Date('2024-09-05T00:00:00Z');
    const digest = formatTransparencyDigest(reference, [baseReport]);
    expect(digest.markdown).toContain('# Bulletin de transparence (2024-09-05)');
    expect(digest.markdown).toContain('runs 42');
    expect(digest.markdown).toContain('CEPEJ 95');
    expect(digest.markdown).toContain('[Rapport](https://docs.avocat-ai.example/transparency-reports/org-1/r1)');
    expect(digest.summary).toBe('Synthèse de 1 rapport(s) de transparence.');
  });

  it('returns fallback copy when no reports exist', () => {
    const reference = new Date('2024-09-05T00:00:00Z');
    const digest = formatTransparencyDigest(reference, []);
    expect(digest.markdown).toContain('Aucun rapport de transparence généré');
    expect(digest.summary).toContain('Aucun rapport');
  });
});
