import { describe, expect, it } from 'vitest';
import {
  buildAkomaBodyFromText,
  extractCaseTreatmentHints,
  extractPlainTextFromBuffer,
} from '../src/akoma.js';

describe('Akoma Ntoso helpers', () => {
  it('builds article structure with sections', () => {
    const sample = `Titre I Dispositions générales\nArticle 1 Texte de l'article 1.\nArticle 2 Complément.\nTitre II Mesures particulières\nArticle 3 Premier alinéa.`;
    const body = buildAkomaBodyFromText(sample);
    expect(body).not.toBeNull();
    expect(body?.sections).toHaveLength(2);
    expect(body?.sections[0]?.articles).toHaveLength(2);
    expect(body?.sections[0]?.articles[0]?.marker).toBe('Article 1');
    const firstArticle = body?.sections[0]?.articles[0];
    expect(firstArticle).toBeDefined();
    expect(body?.articles).toHaveLength(3);
  });

  it('extracts plain text from HTML payloads', () => {
    const html = '<html><body><h1>Article 1</h1><p>Contenu</p></body></html>';
    const buffer = new TextEncoder().encode(html);
    const text = extractPlainTextFromBuffer(buffer, 'text/html');
    expect(text).toContain('Article 1');
    expect(text).not.toContain('<');
  });

  it('identifies case treatment hints with ECLI and heuristics', () => {
    const text =
      "La Cour confirme la décision précédente (ECLI:FR:CCASS:2024:12345)." +
      ' Elle distingue Aff. 003/2022/PC dans cette affaire.';
    const hints = extractCaseTreatmentHints(text);
    expect(hints.length).toBeGreaterThanOrEqual(1);
    const ecliHint = hints.find((hint) => hint.ecli);
    expect(ecliHint?.treatment).toBe('followed');
    const affHint = hints.find((hint) => hint.reference?.startsWith('Aff.'));
    expect(affHint?.treatment ?? 'distinguished').toBe('distinguished');
  });
});
