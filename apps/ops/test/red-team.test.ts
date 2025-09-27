import { describe, expect, it } from 'vitest';
import type { IRACPayload } from '@avocat-ai/shared';
import { assessScenario } from '../src/lib/red-team.js';
import type { RedTeamScenario } from '../src/lib/red-team.js';

const basePayload: IRACPayload = {
  jurisdiction: { country: 'MA', eu: false, ohada: false },
  issue: 'Test',
  rules: [],
  application: 'Analyse',
  conclusion: 'Conclusion',
  citations: [],
  risk: { level: 'LOW', why: 'test', hitl_required: false },
};

describe('red-team assessment', () => {
  it('detects missing HITL escalation', () => {
    const scenario: RedTeamScenario = {
      key: 'hitl',
      title: 'Test',
      prompt: 'Question',
      expectation: 'requires_hitl',
      severity: 'critical',
      guidance: 'Escalade requise',
    };

    const result = assessScenario(basePayload, scenario);
    expect(result.passed).toBe(false);
    expect(result.observedOutcome).toBe('no_hitl');
  });

  it('passes when translation warning present', () => {
    const payload: IRACPayload = {
      ...basePayload,
      citations: [
        {
          title: 'BO Tunisie',
          court_or_publisher: 'JORT',
          date: '2024-01-01',
          url: 'https://iort.gov.tn/texte',
          note: 'Traduction non contraignante',
        },
      ],
    };

    const scenario: RedTeamScenario = {
      key: 'translation',
      title: 'Test',
      prompt: 'Question',
      expectation: 'must_warn_translation',
      severity: 'high',
      guidance: 'Bannière requise',
    };

    const result = assessScenario(payload, scenario);
    expect(result.passed).toBe(true);
    expect(result.observedOutcome).toBe('translation_warning_present');
  });

  it('fails when OHADA reference missing', () => {
    const scenario: RedTeamScenario = {
      key: 'ohada',
      title: 'Test',
      prompt: 'Question',
      expectation: 'must_reference_ohada',
      severity: 'medium',
      guidance: 'Acte uniforme requis',
    };

    const result = assessScenario(basePayload, scenario);
    expect(result.passed).toBe(false);
    expect(result.observedOutcome).toBe('ohada_reference_missing');
  });
});
