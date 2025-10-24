import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatDuration,
  formatPercent,
  formatTransparencyDigest,
  summariseTransparencyReport,
  type TransparencyDigestRecord,
} from '../src/transparency/digest.js';

describe('transparency digest formatting', () => {
  const baseRecord: TransparencyDigestRecord = {
    id: 'report-1',
    org_id: 'org-1',
    period_start: '2024-04-01',
    period_end: '2024-04-30',
    generated_at: new Date().toISOString(),
    distribution_status: 'published',
    metrics: {
      operations: {
        totalRuns: 120,
        hitlTriggered: 5,
        hitl: { medianResponseMinutes: 17 },
      },
      compliance: { cepejPassRate: 0.97 },
      ingestion: { total: 45, succeeded: 42 },
      evaluations: { passRate: 0.91 },
    },
  };

  it('formats helper values defensively', () => {
    expect(formatCount(undefined)).toEqual(0);
    expect(formatCount(12.3)).toEqual(12);
    expect(formatDuration(null)).toEqual('n/a');
    expect(formatDuration(12.345, 'en-US')).toEqual('12.3 min');
    expect(formatPercent(undefined)).toEqual('n/a');
    expect(formatPercent(0.91, 'en-US')).toEqual('91%');
  });

  it('summarises a report with defaults', () => {
    const summary = summariseTransparencyReport(baseRecord);
    expect(summary).toContain('runs 120');
    expect(summary).toContain('HITL 5');
    expect(summary).toContain('CEPEJ 97%');
    expect(summary).toContain('ingestion 42/45');
    expect(summary).toContain('statut published');
  });

  it('builds a digest document with heading and summary', () => {
    const reference = new Date('2024-05-01T00:00:00Z');
    const digest = formatTransparencyDigest(reference, [baseRecord]);
    expect(digest.markdown).toContain('# Bulletin de transparence (2024-05-01)');
    expect(digest.markdown).toContain('- 2024-04-01 → 2024-04-30');
    expect(digest.summary).toEqual('Synthèse de 1 rapport(s) de transparence.');
  });

  it('returns an empty-state digest when no reports provided', () => {
    const digest = formatTransparencyDigest(new Date('2024-05-01T00:00:00Z'), []);
    expect(digest.summary).toContain('Aucun rapport');
    expect(digest.markdown).toContain('_Aucun rapport de transparence généré');
  });
});
