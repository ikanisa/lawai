export type AkomaArticle = {
  marker: string;
  heading: string;
  excerpt: string;
  paragraphs: string[];
  section?: string | null;
};

export type AkomaSection = {
  heading: string;
  articles: AkomaArticle[];
};

export type AkomaBody = {
  sections: AkomaSection[];
  articles: AkomaArticle[];
};

const textDecoder = new TextDecoder('utf-8', { fatal: false });

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function extractPlainTextFromBuffer(payload: Uint8Array, mimeType: string): string {
  if (!payload || payload.byteLength === 0) {
    return '';
  }

  const raw = textDecoder.decode(payload);
  if (!raw) {
    return '';
  }

  if (mimeType === 'text/html' || mimeType === 'application/xhtml+xml') {
    return normaliseWhitespace(stripHtml(raw));
  }

  if (mimeType.includes('xml')) {
    return normaliseWhitespace(stripHtml(raw));
  }

  if (mimeType.startsWith('text/')) {
    return normaliseWhitespace(raw);
  }

  // For binary formats (PDF, images) we currently do not attempt OCR.
  return '';
}

function isSectionHeading(line: string): boolean {
  return /^(titre|chapitre|section)\s+[ivxlcdm0-9a-z-]+/i.test(line);
}

function isArticleHeading(line: string): boolean {
  return /^(article|art\.)\s*[0-9a-z][0-9a-z.-]*/i.test(line);
}

function formatExcerpt(paragraphs: string[]): string {
  const combined = paragraphs.join(' ').trim();
  if (combined.length <= 400) {
    return combined;
  }
  return `${combined.slice(0, 397)}...`;
}

export function buildAkomaBodyFromText(text: string): AkomaBody | null {
  if (!text) {
    return null;
  }

  const lines = text
    .split(/\n+/)
    .map((line) => normaliseWhitespace(line))
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return null;
  }

  const sections: AkomaSection[] = [];
  const rootArticles: AkomaArticle[] = [];
  let currentSection: AkomaSection | null = null;
  let currentArticle: AkomaArticle | null = null;

  for (const line of lines) {
    if (isSectionHeading(line)) {
      currentSection = { heading: line, articles: [] };
      sections.push(currentSection);
      currentArticle = null;
      continue;
    }

    if (isArticleHeading(line)) {
      if (currentArticle) {
        currentArticle.excerpt = formatExcerpt(currentArticle.paragraphs);
      }

      const headingMatch = line.match(/^(article|art\.)\s*[0-9a-z][0-9a-z.-]*/i);
      const marker = headingMatch?.[0] ? headingMatch[0].trim() : line;
      const remainder = headingMatch ? line.slice(headingMatch[0].length).trim() : '';
      const dashes = String.fromCharCode(0x2013, 0x2014); // en-dash, em-dash
      const markerRegex = new RegExp(`^[-:${dashes}]\\s*`);
      const initialParagraph = remainder.replace(markerRegex, '');

      currentArticle = {
        marker,
        heading: marker,
        paragraphs: [],
        excerpt: '',
        section: currentSection?.heading ?? null,
      };

      if (currentSection) {
        currentSection.articles.push(currentArticle);
      } else {
        rootArticles.push(currentArticle);
      }

      if (initialParagraph.length > 0) {
        currentArticle.paragraphs.push(initialParagraph);
      }
      continue;
    }

    if (currentArticle) {
      currentArticle.paragraphs.push(line);
    }
  }

  if (currentArticle) {
    currentArticle.excerpt = formatExcerpt(currentArticle.paragraphs);
  }

  const allArticles = [
    ...sections.flatMap((section) => section.articles),
    ...rootArticles,
  ].map((article) => ({
    ...article,
    excerpt: article.excerpt || formatExcerpt(article.paragraphs),
  }));

  return {
    sections,
    articles: allArticles,
  };
}

export type CaseTreatmentHint = {
  reference: string;
  sentence: string;
  treatment: 'followed' | 'applied' | 'distinguished' | 'overruled' | 'criticized' | 'questioned';
  weight: number;
  ecli?: string;
};

const SENTENCE_SPLIT_REGEX = /(?<!\bAff)(?<!\bArt)(?<!\bN°)(?<!\bNo)(?<!\bMr)(?<!\bMme)(?<=[.!?])\s+/i;

function mergeAbbreviationSegments(segments: string[]): string[] {
  const merged: string[] = [];
  const trailingAbbreviation = /(\bAff\.|\bArt\.|\bN°|\bNo\.?|\bNº)$/i;

  for (const segment of segments) {
    const lastIndex = merged.length - 1;
    const lastSegment = lastIndex >= 0 ? merged[lastIndex] : null;
    if (lastSegment && trailingAbbreviation.test(lastSegment)) {
      merged[lastIndex] = `${lastSegment} ${segment}`.trim();
      continue;
    }

    merged.push(segment);
  }

  return merged;
}

function splitSentences(text: string): string[] {
  if (!text) {
    return [];
  }

  if (typeof (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('fr', { granularity: 'sentence' });
    return mergeAbbreviationSegments(
      Array.from(segmenter.segment(text))
        .map(({ segment }) => segment.trim())
        .filter((segment) => segment.length > 0),
    );
  }

  return mergeAbbreviationSegments(
    text
      .split(SENTENCE_SPLIT_REGEX)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0),
  );
}

function detectTreatment(sentence: string): CaseTreatmentHint['treatment'] {
  const lower = sentence.toLowerCase();
  if (/(casse|annule|infirme|rejette|invalide)/.test(lower)) {
    return 'overruled';
  }
  if (/(distingu|écarte|ecarte|nuance|limite)/.test(lower)) {
    return 'distinguished';
  }
  if (/(critique|conteste|met en cause)/.test(lower)) {
    return 'criticized';
  }
  if (/(questionne|s'interroge|renvoie)/.test(lower)) {
    return 'questioned';
  }
  if (/(confirme|applique|suit|entérine|entériné|adopte)/.test(lower)) {
    return 'followed';
  }
  return 'applied';
}

function treatmentWeight(treatment: CaseTreatmentHint['treatment']): number {
  switch (treatment) {
    case 'overruled':
      return 1;
    case 'criticized':
      return 0.9;
    case 'followed':
      return 0.85;
    case 'distinguished':
      return 0.7;
    case 'questioned':
      return 0.65;
    default:
      return 0.75;
  }
}

export function extractCaseTreatmentHints(text: string): CaseTreatmentHint[] {
  if (!text) {
    return [];
  }

  const sentences = splitSentences(text);
  const seen = new Set<string>();
  const hints: CaseTreatmentHint[] = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) {
      continue;
    }

    const treatment = detectTreatment(trimmed);
    const ecliMatches = Array.from(trimmed.matchAll(/ECLI:[A-Z0-9:_.-]+/gi));
    if (ecliMatches.length > 0) {
      for (const match of ecliMatches) {
        const reference = match[0];
        if (reference && !seen.has(reference)) {
          seen.add(reference);
          hints.push({
            reference,
            sentence: trimmed,
            treatment,
            weight: treatmentWeight(treatment),
            ecli: reference.toUpperCase(),
          });
        }
      }
      continue;
    }

    const genericMatches = Array.from(
      trimmed.matchAll(/\b(?:aff\.|arr[ée]t|d[ée]cision|n°)\s*[0-9]{2,4}[/0-9A-Za-z-]*/gi),
    );
    for (const match of genericMatches) {
      const reference = match[0].trim();
      if (reference && !seen.has(reference)) {
        seen.add(reference);
        hints.push({
          reference,
          sentence: trimmed,
          treatment,
          weight: treatmentWeight(treatment),
        });
      }
    }
  }

  return hints;
}
