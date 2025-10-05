import { describe, expect, it } from 'vitest';
import { evaluateCompliance } from '../src/compliance.js';

const basePayload = {
  jurisdiction: { country: 'FR', eu: true, ohada: false },
  issue: 'Question juridique',
  rules: [
    {
      citation: 'Code civil, art. 1240',
      source_url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417902/',
      binding: true,
      effective_date: '2016-10-01',
      kind: 'statute' as const,
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
  provenance: {
    eli: [],
    ecli: [],
    akoma_articles: 0,
    feeds: [],
    statute_alignments: [],
    disclosures: {
      consent: { required: null, acknowledged: null },
      council_of_europe: { required: null, acknowledged: null },
      satisfied: false,
    },
    quarantine: { flagged: false, reason: null },
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

  it('flags statute-first violations when no binding statute is present', () => {
    const assessment = evaluateCompliance({
      question: 'Analyse jurisprudentielle pure',
      payload: {
        ...basePayload,
        rules: [
          {
            citation: 'Cour de cassation, chambre sociale',
            source_url: 'https://www.courdecassation.fr',
            binding: true,
            effective_date: '2020-01-01',
            kind: 'case' as const,
          },
        ],
        provenance: {
          ...basePayload.provenance,
          statute_alignments: [],
        },
      },
      primaryJurisdiction: { country: 'FR', eu: true, ohada: false },
    });

    expect(assessment.statute.passed).toBe(false);
    expect(assessment.statute.violations).toEqual(
      expect.arrayContaining(['first_rule_not_statute', 'no_binding_statute_rule', 'missing_case_statute_alignment']),
    );
  });

  it('detects disclosure gaps when consent or Council of Europe acks are missing', () => {
    const assessment = evaluateCompliance({
      question: 'Analyse',
      payload: basePayload,
      primaryJurisdiction: { country: 'FR', eu: true, ohada: false },
      disclosures: {
        requiredConsentVersion: 'v2',
        acknowledgedConsentVersion: null,
        requiredCoeVersion: '2024-01',
        acknowledgedCoeVersion: null,
      },
    });

    expect(assessment.disclosures.missing).toEqual(expect.arrayContaining(['consent', 'council_of_europe']));
    expect(assessment.disclosures.consentSatisfied).toBe(false);
    expect(assessment.disclosures.councilSatisfied).toBe(false);
  });
});
