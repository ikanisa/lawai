import { describe, expect, it } from 'vitest';
import { evaluateCompliance } from '../src/compliance.ts';

const basePayload = {
  jurisdiction: { country: 'FR', eu: true, ohada: false },
  issue: 'Question juridique',
  rules: [
    {
      citation: 'Code civil, art. 1240',
      source_url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417902/',
      binding: true,
      effective_date: '2016-10-01',
    },
  ],
  application: 'Analyse structurée',
  conclusion: 'Conclusion factuelle',
  citations: [
    {
      title: 'Code civil',
      court_or_publisher: 'Légifrance',
      date: '2016-10-01',
      url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417902/',
      note: 'consolidé',
    },
  ],
  risk: {
    level: 'LOW' as const,
    why: 'Analyse standard',
    hitl_required: false,
  },
};

describe('evaluateCompliance', () => {
  it('flags EU AI Act FRIA requirements when litigation keywords are present', () => {
    const assessment = evaluateCompliance({
      question:
        "Prépare une requête introductive d'instance devant le tribunal judiciaire de Paris pour contester une sanction.",
      payload: basePayload,
      primaryJurisdiction: { country: 'FR', eu: true, ohada: false },
    });

    expect(assessment.fria.required).toBe(true);
    expect(assessment.fria.reasons.length).toBeGreaterThan(0);
  });

  it('detects CEPEJ transparency violations when citations are missing', () => {
    const assessment = evaluateCompliance({
      question: 'Analyse disciplinaire sans source',
      payload: { ...basePayload, citations: [], rules: [] },
      primaryJurisdiction: { country: 'FR', eu: true, ohada: false },
    });

    expect(assessment.cepej.passed).toBe(false);
    expect(assessment.cepej.violations).toEqual(expect.arrayContaining(['transparency', 'quality_security']));
  });
});
