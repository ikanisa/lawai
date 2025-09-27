import { IRACPayload } from '@avocat-ai/shared';
import { jsPDF } from 'jspdf';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

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
  addSection(
    headers.risk,
    `${payload.risk.level} — ${payload.risk.why}${payload.risk.hitl_required ? '\nHITL requis' : ''}`,
  );

  doc.save(`analyse-irac-${payload.jurisdiction.country.toLowerCase()}.pdf`);
}

export async function exportIracToDocx(payload: IRACPayload, locale: 'fr' | 'en' = 'fr') {
  const labels = locale === 'fr'
    ? { issue: 'Question', rules: 'Règles', application: 'Application', conclusion: 'Conclusion', risk: 'Risque' }
    : { issue: 'Issue', rules: 'Rules', application: 'Application', conclusion: 'Conclusion', risk: 'Risk' };

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
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  saveAs(blob, `analyse-irac-${payload.jurisdiction.country.toLowerCase()}.docx`);
}
