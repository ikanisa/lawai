import { describe, expect, it } from 'vitest';
import { formatRegulatorDigest } from '../src/regulator-digest.js';

describe('regulator digest formatting', () => {
  it('renders markdown with entries and fallback when empty', () => {
    const now = new Date('2024-09-15T00:00:00Z');
    const digest = formatRegulatorDigest(now, [
      {
        id: 'd1',
        report_type: 'conformité',
        period_start: '2024-09-01',
        period_end: '2024-09-07',
        status: 'envoyé',
        payload_url: 'https://example.com/report.pdf',
        metadata: { regulator: 'CNIL' },
        created_at: '2024-09-08T08:00:00Z',
        dispatched_at: '2024-09-08T09:00:00Z',
      },
    ]);

    expect(digest).toContain('# Bulletin régulateur (2024-09-15)');
    expect(digest).toContain('CNIL');
    expect(digest).toContain('[Dossier](https://example.com/report.pdf)');

    const empty = formatRegulatorDigest(now, []);
    expect(empty).toContain('Aucune notification envoyée');
  });
});
