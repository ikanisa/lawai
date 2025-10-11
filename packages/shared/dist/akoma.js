const textDecoder = new TextDecoder('utf-8', { fatal: false });
function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
}
function normaliseWhitespace(value) {
    return value.replace(/\s+/g, ' ').trim();
}
export function extractPlainTextFromBuffer(payload, mimeType) {
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
function isSectionHeading(line) {
    return /^(titre|chapitre|section)\s+[ivxlcdm0-9a-z-]+/i.test(line);
}
function isArticleHeading(line) {
    return /^(article|art\.)\s*[0-9a-z][0-9a-z.-]*/i.test(line);
}
function formatExcerpt(paragraphs) {
    const combined = paragraphs.join(' ').trim();
    if (combined.length <= 400) {
        return combined;
    }
    return `${combined.slice(0, 397)}...`;
}
export function buildAkomaBodyFromText(text) {
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
    const sections = [];
    const rootArticles = [];
    let currentSection = null;
    let currentArticle = null;
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
            currentArticle = {
                marker: line.match(/^(article|art\.)\s*[0-9a-z][0-9a-z.-]*/i)?.[0] ?? line,
                heading: line,
                paragraphs: [],
                excerpt: '',
                section: currentSection?.heading ?? null,
            };
            if (currentSection) {
                currentSection.articles.push(currentArticle);
            }
            else {
                rootArticles.push(currentArticle);
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
const SENTENCE_SPLIT_REGEX = /(?<=[.!?])\s+/;
function detectTreatment(sentence) {
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
function treatmentWeight(treatment) {
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
export function extractCaseTreatmentHints(text) {
    if (!text) {
        return [];
    }
    const sentences = text.split(SENTENCE_SPLIT_REGEX);
    const seen = new Set();
    const hints = [];
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
        const genericMatches = Array.from(trimmed.matchAll(/\b(?:aff\.|arr[ée]t|d[ée]cision|n°)\s*[0-9]{2,4}[/0-9A-Za-z-]*/gi));
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
