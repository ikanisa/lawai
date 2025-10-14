import { describe, expect, it } from 'vitest';
import type { IRACPayload } from '@avocat-ai/shared';
import { buildEvaluationHaystack, evaluateExpectedTerms } from '../src/lib/evaluation.js';
import {
  checkAcceptanceThresholds,
  checkLinkHealthThreshold,
  computeMetrics,
  loadBenchmarkCases,
} from '../src/evaluate.js';

const basePayload: IRACPayload = {
  jurisdiction: { country: 'FR', eu: true, ohada: false },
  issue: 'Responsabilité délictuelle en cas de dommage causé par un produit défectueux.',
  rules: [
    {
      citation: 'Code civil, article 1245',
      source_url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417907/',
      binding: true,
      effective_date: '2016-10-01',
    },
  ],
  application: 'Analyse du régime de responsabilité sans faute.',
  conclusion: 'La responsabilité est engagée si le défaut est prouvé.',
  citations: [
    {
      title: 'Code civil français',
      court_or_publisher: 'Légifrance',
      date: '2016-10-01',
      url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417907/',
      note: 'consolidé',
    },
  ],
  risk: { level: 'MEDIUM', why: 'Analyse générique sans faits précis', hitl_required: false },
};

describe('evaluation helpers', () => {
  it('normalises the haystack for consistent lookups', () => {
    const haystack = buildEvaluationHaystack(basePayload);
    expect(haystack).toContain('responsabilité');
    expect(haystack).toContain('legiart');
  });

  it('flags missing expectations', () => {
    const result = evaluateExpectedTerms(basePayload, ['responsabilité', 'article 1245', 'cassation']);
    expect(result.pass).toBe(false);
    expect(result.missing).toContain('cassation');
    expect(result.missing).not.toContain('responsabilité');
  });

  it('passes when every expected snippet is found', () => {
    const result = evaluateExpectedTerms(basePayload, ['responsabilité', 'article 1245']);
    expect(result.pass).toBe(true);
    expect(result.missing.length).toBe(0);
  });

  it('loads benchmark datasets from fixtures', async () => {
    const dataset = await loadBenchmarkCases('legalbench');
    expect(dataset.length).toBeGreaterThan(0);
    expect(dataset[0].benchmark).toBe('legalbench');
    expect(typeof dataset[0].prompt).toBe('string');
  });

  it('computes metrics and detects Maghreb coverage', () => {
    const baseMetrics = computeMetrics(basePayload);
    expect(baseMetrics.citationPrecision).toBe(1);
    expect(baseMetrics.temporalValidity).toBe(1);
    expect(baseMetrics.maghrebBanner).toBeNull();
    expect(baseMetrics.rwandaNotice).toBeNull();

    const maghrebPayload: IRACPayload = {
      ...basePayload,
      jurisdiction: { country: 'MA', eu: false, ohada: false },
      citations: [
        {
          title: 'Bulletin officiel',
          court_or_publisher: 'Secrétariat général du gouvernement',
          date: '2024-01-01',
          url: 'https://www.sgg.gov.ma/bo/bo_francais/2024/bo_7150_fr.pdf',
          note: 'traduction officielle',
        },
      ],
    };
    const maghrebMetrics = computeMetrics(maghrebPayload);
    expect(maghrebMetrics.maghrebBanner).toBe(true);
    expect(maghrebMetrics.jurisdiction).toBe('MA');

    const rwandaPayload: IRACPayload = {
      ...basePayload,
      jurisdiction: { country: 'RW', eu: false, ohada: false },
      risk: {
        ...basePayload.risk,
        why: `${basePayload.risk.why} | La Gazette officielle du Rwanda est publiée en kinyarwanda et en anglais; les versions françaises doivent être vérifiées.`,
      },
      citations: [
        {
          title: 'Official Gazette',
          court_or_publisher: 'Rwanda Law Reform Commission',
          date: '2024-01-01',
          url: 'https://gazette.gov.rw/2024/official-gazette',
          note: 'La Gazette officielle du Rwanda est publiée en kinyarwanda et en anglais; les versions françaises doivent être vérifiées.',
        },
      ],
    };
    const rwandaMetrics = computeMetrics(rwandaPayload);
    expect(rwandaMetrics.rwandaNotice).toBe(true);
    expect(rwandaMetrics.jurisdiction).toBe('RW');
  });

  it('enforces acceptance thresholds', () => {
    const okResult = checkAcceptanceThresholds([
      {
        citationPrecision: 0.98,
        temporalValidity: 0.99,
        bindingWarnings: 0,
        jurisdiction: 'FR',
        maghrebBanner: null,
        rwandaNotice: null,
      },
      {
        citationPrecision: 0.97,
        temporalValidity: 0.96,
        bindingWarnings: 1,
        jurisdiction: 'MA',
        maghrebBanner: true,
        rwandaNotice: null,
      },
      {
        citationPrecision: 0.99,
        temporalValidity: 0.97,
        bindingWarnings: 0,
        jurisdiction: 'RW',
        maghrebBanner: null,
        rwandaNotice: true,
      },
    ]);
    expect(okResult.ok).toBe(true);

    const failResult = checkAcceptanceThresholds([
      {
        citationPrecision: 0.90,
        temporalValidity: 0.96,
        bindingWarnings: 0,
        jurisdiction: 'FR',
        maghrebBanner: null,
        rwandaNotice: null,
      },
      {
        citationPrecision: 0.94,
        temporalValidity: 0.80,
        bindingWarnings: 0,
        jurisdiction: 'MA',
        maghrebBanner: false,
        rwandaNotice: null,
      },
      {
        citationPrecision: 0.90,
        temporalValidity: 0.92,
        bindingWarnings: 0,
        jurisdiction: 'RW',
        maghrebBanner: null,
        rwandaNotice: false,
      },
    ]);
    expect(failResult.ok).toBe(false);
    expect(failResult.failures.length).toBeGreaterThan(0);
  });

  it('evaluates link health tolerances', () => {
    const pass = checkLinkHealthThreshold({
      totalSources: 20,
      failedSources: 1,
      staleSources: 3,
      failureRatio: 0.05,
    });
    expect(pass.ok).toBe(true);

    const fail = checkLinkHealthThreshold({
      totalSources: 10,
      failedSources: 2,
      staleSources: 1,
      failureRatio: 0.2,
    });
    expect(fail.ok).toBe(false);
    expect(fail.failure).toContain('Liens officiels défaillants');
  });
});
