import { IRACPayload } from '@avocat-ai/shared';
import { API_BASE, DEMO_ORG_ID, DEMO_USER_ID, type TrustPanelComplianceSummary } from './api';
import { jsPDF } from 'jspdf';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import type { Messages } from './i18n';

function formatRules(payload: IRACPayload) {
  return payload.rules
    .map((rule, index) => `${index + 1}. ${rule.citation}\n${rule.source_url}\n${rule.effective_date}`)
    .join('\n\n');
}

function formatProofMetadata(proof: C2PASignature) {
  const signedAt = new Date(proof.signedAt);
  const firstLine = `Signature ${proof.algorithm}/${proof.keyId} — ${proof.signature.slice(0, 32)}…`;
  const secondLine = `Statement ${proof.statementId} — ${signedAt.toLocaleString()}`;
  return [firstLine, secondLine];
}

interface C2PASignature {
  signature: string;
  keyId: string;
  algorithm: string;
  signedAt: string;
  statementId: string;
  manifest: {
    '@context': string;
    version: string;
    claim_generator: string;
    statement_id: string;
    signed_at: string;
    assertions: Array<{
      label: string;
      digest: { algorithm: string; value: string };
      filename?: string | null;
    }>;
    subject?: { org: string; user: string };
  };
}

type ComplianceExportCopy = {
  heading: string;
  fria: string;
  friaFallback: string;
  cepej: string;
  cepejFallback: string;
  statute: string;
  statuteFallback: string;
  disclosures: string;
  disclosuresFallback: string;
  resolved: string;
  consentAcknowledged: string;
  consentPending: string;
  coeAcknowledged: string;
  coePending: string;
  unavailable: string;
};

const complianceCopyFallback: Record<'en' | 'fr', ComplianceExportCopy> = {
  en: {
    heading: 'Compliance summary',
    fria: 'FRIA checkpoint required — {reason}',
    friaFallback: 'Reason unavailable.',
    cepej: 'CEPEJ charter issues — {detail}',
    cepejFallback: 'Review CEPEJ charter obligations.',
    statute: 'Statute-first enforcement — {detail}',
    statuteFallback: 'Confirm a binding statute anchors the analysis.',
    disclosures: 'Disclosures pending — {detail}',
    disclosuresFallback: 'Confirm consent and Council of Europe disclosures are acknowledged.',
    resolved: 'All compliance checkpoints satisfied.',
    consentAcknowledged: 'Consent banner acknowledged (v{version}).',
    consentPending: 'Consent banner pending (v{version}).',
    coeAcknowledged: 'Council of Europe notice acknowledged (v{version}).',
    coePending: 'Council of Europe notice pending (v{version}).',
    unavailable: 'Compliance summary unavailable for this run.',
  },
  fr: {
    heading: 'Synthèse de conformité',
    fria: 'Checkpoint FRIA obligatoire — {reason}',
    friaFallback: 'Raison non disponible.',
    cepej: 'Non-conformités CEPEJ — {detail}',
    cepejFallback: 'Vérifier les obligations de la charte CEPEJ.',
    statute: 'Garde-fou statute-first déclenché — {detail}',
    statuteFallback: 'Confirmer qu’un texte contraignant ouvre l’analyse.',
    disclosures: 'Disclosures en attente — {detail}',
    disclosuresFallback: 'Confirmer la validation du consentement et de la notice Conseil de l’Europe.',
    resolved: 'Tous les checkpoints de conformité sont satisfaits.',
    consentAcknowledged: 'Bannière de consentement validée (v{version}).',
    consentPending: 'Bannière de consentement en attente (v{version}).',
    coeAcknowledged: 'Notice Conseil de l’Europe validée (v{version}).',
    coePending: 'Notice Conseil de l’Europe en attente (v{version}).',
    unavailable: 'Synthèse de conformité indisponible pour cette exécution.',
  },
};

interface ExportComplianceOptions {
  summary: TrustPanelComplianceSummary | null | undefined;
  messages?: Messages['research']['compliance'];
  copy?: Partial<ComplianceExportCopy>;
}

interface ComplianceSection {
  heading: string;
  body: string[];
  acknowledgements: string[];
}

interface ExportOptions {
  compliance?: ExportComplianceOptions;
}

function resolveComplianceCopy(
  locale: 'fr' | 'en',
  override?: Partial<ComplianceExportCopy>,
): ComplianceExportCopy {
  const fallback = complianceCopyFallback[locale] ?? complianceCopyFallback.en;
  return { ...fallback, ...override };
}

function compileComplianceSection(
  locale: 'fr' | 'en',
  options?: ExportComplianceOptions,
): ComplianceSection {
  const summary = options?.summary ?? null;
  const copy = resolveComplianceCopy(locale, options?.copy);
  const complianceMessages = options?.messages;
  if (!summary) {
    return { heading: copy.heading, body: [copy.unavailable], acknowledgements: [] };
  }

  const issues: string[] = [];
  const acknowledgements: string[] = [];
  const cepejMessages = complianceMessages?.cepejViolations ?? {};
  const statuteMessages = complianceMessages?.statuteViolations ?? {};
  const disclosureMessages = complianceMessages?.disclosuresMissing ?? {};

  if (summary.fria.required) {
    const reason = summary.fria.reasons[0] ?? copy.friaFallback;
    issues.push(copy.fria.replace('{reason}', reason));
  }

  if (!summary.cepej.passed) {
    const detail = summary.cepej.violations.length > 0
      ? summary.cepej.violations
          .map((code) => cepejMessages[code as keyof typeof cepejMessages] ?? code)
          .join(', ')
      : copy.cepejFallback;
    issues.push(copy.cepej.replace('{detail}', detail));
  }

  if (!summary.statute.passed) {
    const detail = summary.statute.violations.length > 0
      ? summary.statute.violations
          .map((code) => statuteMessages[code as keyof typeof statuteMessages] ?? code)
          .join(', ')
      : copy.statuteFallback;
    issues.push(copy.statute.replace('{detail}', detail));
  }

  const disclosurePending =
    summary.disclosures.missing.length > 0 ||
    !summary.disclosures.consentSatisfied ||
    !summary.disclosures.councilSatisfied;
  if (disclosurePending) {
    const detail = summary.disclosures.missing.length > 0
      ? summary.disclosures.missing
          .map((code) => disclosureMessages[code as keyof typeof disclosureMessages] ?? code)
          .join(', ')
      : copy.disclosuresFallback;
    issues.push(copy.disclosures.replace('{detail}', detail));
  }

  const consentVersion = summary.disclosures.requiredConsentVersion;
  if (consentVersion) {
    const template = summary.disclosures.consentSatisfied ? copy.consentAcknowledged : copy.consentPending;
    acknowledgements.push(template.replace('{version}', consentVersion));
  }

  const councilVersion = summary.disclosures.requiredCoeVersion;
  if (councilVersion) {
    const template = summary.disclosures.councilSatisfied ? copy.coeAcknowledged : copy.coePending;
    acknowledgements.push(template.replace('{version}', councilVersion));
  }

  if (issues.length === 0) {
    return { heading: copy.heading, body: [copy.resolved], acknowledgements };
  }

  return { heading: copy.heading, body: issues, acknowledgements };
}

async function signExport(text: string, filename: string): Promise<C2PASignature | null> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const res = await fetch(`${API_BASE}/exports/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': DEMO_USER_ID,
      'x-org-id': DEMO_ORG_ID,
    },
    body: JSON.stringify({ orgId: DEMO_ORG_ID, contentSha256: hash, filename }),
  });
  if (!res.ok) {
    console.warn('export_sign_failed', await res.text());
    return null;
  }
  return (await res.json()) as C2PASignature;
}

export async function exportIracToPdf(
  payload: IRACPayload,
  locale: 'fr' | 'en' = 'fr',
  options?: ExportOptions,
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  let cursor = margin;
  const lineHeight = 16;
  const complianceSection = compileComplianceSection(locale, options?.compliance);

  function addSection(title: string, content: string) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, margin, cursor);
    cursor += lineHeight;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    const textLines = doc.splitTextToSize(content, 515);
    doc.text(textLines, margin, cursor);
    cursor += lineHeight * textLines.length + lineHeight / 2;
  }

  const headers = locale === 'fr'
    ? { issue: 'Question', rules: 'Règles', application: 'Application', conclusion: 'Conclusion', risk: 'Risque' }
    : { issue: 'Issue', rules: 'Rules', application: 'Application', conclusion: 'Conclusion', risk: 'Risk' };

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Analyse IRAC — ${payload.jurisdiction.country}`, margin, cursor);
  cursor += lineHeight * 1.5;

  addSection(headers.issue, payload.issue);
  addSection(headers.rules, formatRules(payload));
  addSection(headers.application, payload.application);
  addSection(headers.conclusion, payload.conclusion);
  const riskText = `${payload.risk.level} — ${payload.risk.why}${payload.risk.hitl_required ? '\nHITL requis' : ''}`;
  addSection(headers.risk, riskText);
  const complianceLines = [...complianceSection.body];
  if (complianceSection.acknowledgements.length > 0) {
    complianceLines.push(...complianceSection.acknowledgements);
  }
  addSection(complianceSection.heading, complianceLines.join('\n'));
  const proof = await signExport(
    [
      payload.issue,
      formatRules(payload),
      payload.application,
      payload.conclusion,
      riskText,
      ...complianceLines,
    ].join('\n'),
    `analyse-irac-${payload.jurisdiction.country.toLowerCase()}.pdf`,
  );
  if (proof) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    const [line1, line2] = formatProofMetadata(proof);
    doc.text(line1, margin, 800);
    doc.text(line2, margin, 814);
  }

  doc.save(`analyse-irac-${payload.jurisdiction.country.toLowerCase()}.pdf`);
}

export async function exportIracToDocx(
  payload: IRACPayload,
  locale: 'fr' | 'en' = 'fr',
  options?: ExportOptions,
) {
  const labels = locale === 'fr'
    ? { issue: 'Question', rules: 'Règles', application: 'Application', conclusion: 'Conclusion', risk: 'Risque' }
    : { issue: 'Issue', rules: 'Rules', application: 'Application', conclusion: 'Conclusion', risk: 'Risk' };

  const complianceSection = compileComplianceSection(locale, options?.compliance);
  const proofPayload = JSON.stringify({ payload, compliance: complianceSection });
  const proof = await signExport(
    proofPayload,
    `analyse-irac-${payload.jurisdiction.country.toLowerCase()}.docx`,
  );

  const children: Paragraph[] = [
    new Paragraph({
      text: `Analyse IRAC — ${payload.jurisdiction.country}`,
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: labels.issue, bold: true })],
    }),
    new Paragraph({ text: payload.issue }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: labels.rules, bold: true })] }),
  ];

  children.push(
    ...payload.rules.flatMap((rule, index) => [
      new Paragraph({ text: `${index + 1}. ${rule.citation}`, bullet: { level: 0 } }),
      new Paragraph({ text: rule.source_url, indent: { left: 720 } }),
      new Paragraph({ text: rule.effective_date, indent: { left: 720 } }),
    ]),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: labels.application, bold: true })] }),
    new Paragraph({ text: payload.application }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: labels.conclusion, bold: true })] }),
    new Paragraph({ text: payload.conclusion }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: labels.risk, bold: true })] }),
    new Paragraph({ text: `${payload.risk.level} — ${payload.risk.why}` }),
  );

  if (payload.risk.hitl_required) {
    children.push(new Paragraph({ text: locale === 'fr' ? 'Revue humaine requise.' : 'Human review required.' }));
  }

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: complianceSection.heading, bold: true })],
    }),
  );
  complianceSection.body.forEach((line) => {
    children.push(new Paragraph({ text: line }));
  });
  complianceSection.acknowledgements.forEach((line) => {
    children.push(new Paragraph({ text: line }));
  });

  if (proof) {
    const proofLines = formatProofMetadata(proof);
    proofLines.forEach((line) => {
      children.push(new Paragraph({ text: line }));
    });
  }

  const document = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  saveAs(blob, `analyse-irac-${payload.jurisdiction.country.toLowerCase()}.docx`);
}
