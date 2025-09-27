import { describe, expect, it } from 'vitest';
import { evaluateCaseQuality } from '../src/case-quality.js';

describe('evaluateCaseQuality', () => {
  it('returns high score for aligned supreme court decision', () => {
    const result = evaluateCaseQuality({
      trustTier: 'T2',
      courtRank: 'supreme',
      jurisdiction: 'FR',
      bindingJurisdiction: 'FR',
      politicalRiskFlag: false,
      bindingLanguage: 'fr',
      effectiveDate: '2023-01-01',
      createdAt: '2023-01-01',
      treatments: [{ treatment: 'followed', weight: 1 }],
      statuteAlignments: [{ alignmentScore: 92 }],
      riskOverlays: [],
      override: null,
    });

    expect(result.score).toBeGreaterThan(80);
    expect(result.hardBlock).toBe(false);
  });

  it('hard blocks overruled cases', () => {
    const result = evaluateCaseQuality({
      trustTier: 'T2',
      courtRank: 'appellate',
      jurisdiction: 'FR',
      bindingJurisdiction: 'FR',
      politicalRiskFlag: false,
      bindingLanguage: 'fr',
      effectiveDate: '2010-01-01',
      createdAt: '2010-01-01',
      treatments: [{ treatment: 'overruled', weight: 1 }],
      statuteAlignments: [{ alignmentScore: 60 }],
      riskOverlays: [],
      override: null,
    });

    expect(result.hardBlock).toBe(true);
    expect(result.score).toBe(0);
  });

  it('applies override when present', () => {
    const result = evaluateCaseQuality({
      trustTier: 'T3',
      courtRank: 'tribunal',
      jurisdiction: 'FR',
      bindingJurisdiction: 'FR',
      politicalRiskFlag: false,
      bindingLanguage: 'fr',
      effectiveDate: null,
      createdAt: '2020-01-01',
      treatments: [],
      statuteAlignments: [],
      riskOverlays: [],
      override: { score: 45, reason: 'Reviewer downgrade' },
    });

    expect(result.score).toBe(45);
    expect(result.notes).toContain('override_applied');
  });
});
