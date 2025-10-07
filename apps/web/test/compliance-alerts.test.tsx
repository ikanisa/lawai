import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import messagesEn from '../messages/en.json';
import type { ComplianceAssessment } from '../src/lib/api';
import { ComplianceAlerts } from '../src/components/research/compliance-alerts';

describe('ComplianceAlerts', () => {
  it('renders outstanding compliance issues', () => {
    const compliance: ComplianceAssessment = {
      fria: { required: true, reasons: ['High-risk workflow detected'] },
      cepej: { passed: false, violations: ['transparency'] },
      statute: { passed: false, violations: ['first_rule_not_statute'] },
      disclosures: {
        consentSatisfied: false,
        councilSatisfied: true,
        missing: ['consent'],
        requiredConsentVersion: '2024-01',
        acknowledgedConsentVersion: null,
        requiredCoeVersion: '2024-01',
        acknowledgedCoeVersion: '2024-01',
      },
    };

    render(
      <ComplianceAlerts
        compliance={compliance}
        messages={messagesEn.research.compliance}
      />,
    );

    expect(screen.getByText(messagesEn.research.compliance.friaRequired)).toBeInTheDocument();
    expect(
      screen.getByText(messagesEn.research.compliance.cepejViolations.transparency),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messagesEn.research.compliance.statuteViolations.first_rule_not_statute),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messagesEn.research.compliance.disclosuresMissing.consent),
    ).toBeInTheDocument();
  });

  it('renders resolved state when no issues remain', () => {
    const compliance: ComplianceAssessment = {
      fria: { required: false, reasons: [] },
      cepej: { passed: true, violations: [] },
      statute: { passed: true, violations: [] },
      disclosures: {
        consentSatisfied: true,
        councilSatisfied: true,
        missing: [],
        requiredConsentVersion: null,
        acknowledgedConsentVersion: null,
        requiredCoeVersion: null,
        acknowledgedCoeVersion: null,
      },
    };

    render(
      <ComplianceAlerts
        compliance={compliance}
        messages={messagesEn.research.compliance}
      />,
    );

    expect(screen.getByText(messagesEn.research.compliance.resolved)).toBeInTheDocument();
  });
});
