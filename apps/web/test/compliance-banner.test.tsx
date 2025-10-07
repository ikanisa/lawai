import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import messagesEn from '../messages/en.json';
import type { ComplianceAssessment } from '../src/lib/api';
import { ComplianceBanner } from '../src/components/compliance-banner';

describe('ComplianceBanner', () => {
  it('renders compliance issues and acknowledgement lines', () => {
    const compliance: ComplianceAssessment = {
      fria: { required: true, reasons: ['High-risk workflow detected'] },
      cepej: { passed: false, violations: ['transparency'] },
      statute: { passed: false, violations: ['first_rule_not_statute'] },
      disclosures: {
        consentSatisfied: false,
        councilSatisfied: false,
        missing: ['consent'],
        requiredConsentVersion: '2024-01',
        acknowledgedConsentVersion: null,
        requiredCoeVersion: '2024-02',
        acknowledgedCoeVersion: null,
      },
    };

    render(
      <ComplianceBanner
        compliance={compliance}
        messages={messagesEn.research.compliance}
      />,
    );

    expect(screen.getByText(messagesEn.research.compliance.title)).toBeInTheDocument();
    const friaLine = `${messagesEn.research.compliance.friaRequired} — ${compliance.fria.reasons[0]}`;
    const cepejLine = `${messagesEn.research.compliance.cepejFailed} — ${messagesEn.research.compliance.cepejViolations.transparency}`;
    const statuteLine = `${messagesEn.research.compliance.statuteFailed} — ${messagesEn.research.compliance.statuteViolations.first_rule_not_statute}`;
    const disclosuresLine = `${messagesEn.research.compliance.disclosuresRequired} — ${messagesEn.research.compliance.disclosuresMissing.consent}`;

    expect(screen.getByText(friaLine)).toBeInTheDocument();
    expect(screen.getByText(cepejLine)).toBeInTheDocument();
    expect(screen.getByText(statuteLine)).toBeInTheDocument();
    expect(screen.getByText(disclosuresLine)).toBeInTheDocument();
    expect(
      screen.getByText(
        messagesEn.research.compliance.consentPending.replace('{version}', '2024-01'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        messagesEn.research.compliance.councilPending.replace('{version}', '2024-02'),
      ),
    ).toBeInTheDocument();
  });

  it('renders resolved state with acknowledgements when compliant', () => {
    const compliance: ComplianceAssessment = {
      fria: { required: false, reasons: [] },
      cepej: { passed: true, violations: [] },
      statute: { passed: true, violations: [] },
      disclosures: {
        consentSatisfied: true,
        councilSatisfied: true,
        missing: [],
        requiredConsentVersion: '2024-03',
        acknowledgedConsentVersion: '2024-03',
        requiredCoeVersion: '2024-04',
        acknowledgedCoeVersion: '2024-04',
      },
    };

    render(
      <ComplianceBanner
        compliance={compliance}
        messages={messagesEn.research.compliance}
      />,
    );

    expect(screen.getByText(messagesEn.research.compliance.resolved)).toBeInTheDocument();
    expect(screen.getByText(messagesEn.research.compliance.resolvedDetail)).toBeInTheDocument();
    expect(
      screen.getByText(
        messagesEn.research.compliance.consentAcknowledged.replace('{version}', '2024-03'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        messagesEn.research.compliance.councilAcknowledged.replace('{version}', '2024-04'),
      ),
    ).toBeInTheDocument();
  });
});
