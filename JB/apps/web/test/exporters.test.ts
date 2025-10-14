import { describe, expect, it } from 'vitest';
import { buildC2paManifest } from '../src/lib/exporters';
import type { IRACPayload } from '@avocat-ai/shared';

const payload: IRACPayload = {
  jurisdiction: { country: 'FR', eu: true, ohada: false },
  issue: 'Responsabilité délictuelle',
  rules: [
    {
      citation: 'Code civil, art. 1240',
      source_url: 'https://legifrance.gouv.fr/code/article_lc/LEGIARTI000006417500/',
      binding: true,
      effective_date: '2024-01-01',
    },
  ],
  application: 'Le dommage et le lien de causalité sont établis.',
  conclusion: 'La responsabilité est engagée.',
  citations: [
    {
      title: 'Cour de cassation, civ. 2e, 28 février 2024',
      court_or_publisher: 'Cour de cassation',
      date: '2024-02-28',
      url: 'https://courdecassation.fr/decision/1234',
      note: 'Arrêt de principe',
    },
  ],
  risk: {
    level: 'MEDIUM',
    why: 'Analyse préliminaire à confirmer par revue humaine.',
    hitl_required: true,
  },
};

describe('buildC2paManifest', () => {
  it('includes hash, jurisdiction, risk, and citation metadata', () => {
    const manifest = buildC2paManifest({
      filename: 'analyse-irac-fr.pdf',
      hash: 'abc123',
      format: 'pdf',
      payload,
      locale: 'fr',
      issuedAt: '2024-01-01T00:00:00Z',
    });

    const parsed = JSON.parse(manifest);
    expect(parsed.subject.name).toBe('analyse-irac-fr.pdf');
    expect(parsed.subject.hash.value).toBe('abc123');
    expect(parsed.evidence.jurisdiction.country).toBe('FR');
    expect(parsed.evidence.citations).toHaveLength(1);
    expect(parsed.locale).toBe('fr');
    expect(parsed.format).toBe('application/pdf');
    expect(parsed.issuedAt).toBe('2024-01-01T00:00:00Z');
  });
});
