import { IRACPayload } from '@avocat-ai/shared';
import { jsPDF } from 'jspdf';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

type ExportFormat = 'pdf' | 'docx';

function getMimeType(format: ExportFormat) {
  return format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

async function computeSha256Hex(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getComplianceDisclaimers(locale: 'fr' | 'en'): string[] {
  if (locale === 'fr') {
    return [
      "Charte éthique CEPEJ : cette analyse respecte les principes de droits fondamentaux, de non-discrimination, de qualité, de transparence et de contrôle humain. Une vérification humaine demeure obligatoire.",
      "Acte IA de l’UE (système à haut risque) : l’assistant complète sans remplacer les professionnels qualifiés. Finalisez toujours les dépôts après validation humaine et consultation des sources officielles citées.",
    ];
  }

  return [
    'CEPEJ Ethical Charter: this analysis upholds fundamental rights, non-discrimination, quality, transparency, and user control. Human oversight remains mandatory.',
    'EU AI Act (high-risk system): the assistant augments but does not replace qualified legal counsel. Always obtain human validation before filing or relying on the output, using the cited official sources.',
  ];
}

interface BuildC2paManifestOptions {
  filename: string;
  hash: string;
  format: ExportFormat;
  payload: IRACPayload;
  locale: 'fr' | 'en';
  issuedAt?: string;
}

export function buildC2paManifest({
  filename,
  hash,
  format,
  payload,
  locale,
  issuedAt,
}: BuildC2paManifestOptions) {
  const manifest = {
    '@context': 'https://c2pa.org/schema/2023-10-18/context.json',
    type: 'application/c2pa+json',
    version: '1.3.0',
    claimGenerator: 'Avocat-AI Francophone Agent',
    locale,
    format: getMimeType(format),
    issuedAt: issuedAt ?? new Date().toISOString(),
    producer: {
      organization: 'Avocat-AI',
      agent: 'Autonomous Francophone Lawyer',
    },
    subject: {
      name: filename,
      hash: {
        algorithm: 'sha256',
        value: hash,
      },
    },
    evidence: {
      jurisdiction: payload.jurisdiction,
      risk: payload.risk,
      rules: payload.rules.map((rule) => ({
        citation: rule.citation,
        url: rule.source_url,
        binding: rule.binding,
        effectiveDate: rule.effective_date,
      })),
      citations: payload.citations.map((citation) => ({
        title: citation.title,
        publisher: citation.court_or_publisher,
        url: citation.url,
        note: citation.note ?? '',
        date: citation.date,
      })),
    },
  };

  return JSON.stringify(manifest, null, 2);
}

async function downloadWithC2paBundle(
  blob: Blob,
  filename: string,
  payload: IRACPayload,
  locale: 'fr' | 'en',
  format: ExportFormat,
) {
  const hash = await computeSha256Hex(blob);
  const manifest = buildC2paManifest({ filename, hash, format, payload, locale });
  const zip = new JSZip();
  zip.file(filename, blob, { binary: true });
  zip.file(`${filename}.c2pa.json`, manifest);
  const archiveBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const archiveName = `${filename.replace(/\.[^.]+$/, '')}-c2pa.zip`;
  saveAs(archiveBlob, archiveName);
}

function formatRules(payload: IRACPayload) {
  return payload.rules
    .map((rule, index) => `${index + 1}. ${rule.citation}\n${rule.source_url}\n${rule.effective_date}`)
    .join('\n\n');
}

export async function exportIracToPdf(payload: IRACPayload, locale: 'fr' | 'en' = 'fr') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  let cursor = margin;
  const lineHeight = 16;

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
    ? {
        issue: 'Question',
        rules: 'Règles',
        application: 'Application',
        conclusion: 'Conclusion',
        risk: 'Risque',
        compliance: 'Conformité & gouvernance',
      }
    : {
        issue: 'Issue',
        rules: 'Rules',
        application: 'Application',
        conclusion: 'Conclusion',
        risk: 'Risk',
        compliance: 'Compliance & governance',
      };

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Analyse IRAC — ${payload.jurisdiction.country}`, margin, cursor);
  cursor += lineHeight * 1.5;

  addSection(headers.issue, payload.issue);
  addSection(headers.rules, formatRules(payload));
  addSection(headers.application, payload.application);
  addSection(headers.conclusion, payload.conclusion);
  const riskNote = locale === 'fr' ? 'Revue humaine requise.' : 'Human review required.';
  addSection(
    headers.risk,
    `${payload.risk.level} — ${payload.risk.why}${payload.risk.hitl_required ? `\n${riskNote}` : ''}`,
  );

  const complianceText = getComplianceDisclaimers(locale).join('\n');
  addSection(headers.compliance, complianceText);

  const fileName = `analyse-irac-${payload.jurisdiction.country.toLowerCase()}.pdf`;
  const pdfBlob = doc.output('blob');
  await downloadWithC2paBundle(pdfBlob, fileName, payload, locale, 'pdf');
}

export async function exportIracToDocx(payload: IRACPayload, locale: 'fr' | 'en' = 'fr') {
  const labels = locale === 'fr'
    ? {
        issue: 'Question',
        rules: 'Règles',
        application: 'Application',
        conclusion: 'Conclusion',
        risk: 'Risque',
        compliance: 'Conformité & gouvernance',
      }
    : {
        issue: 'Issue',
        rules: 'Rules',
        application: 'Application',
        conclusion: 'Conclusion',
        risk: 'Risk',
        compliance: 'Compliance & governance',
      };

  const document = new Document({
    sections: [
      {
        children: [
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
          payload.risk.hitl_required
            ? new Paragraph({ text: locale === 'fr' ? 'Revue humaine requise.' : 'Human review required.' })
            : new Paragraph({ text: '' }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: labels.compliance, bold: true })] }),
          ...getComplianceDisclaimers(locale).map((line) => new Paragraph({ text: line })),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  const fileName = `analyse-irac-${payload.jurisdiction.country.toLowerCase()}.docx`;
  await downloadWithC2paBundle(blob, fileName, payload, locale, 'docx');
}
