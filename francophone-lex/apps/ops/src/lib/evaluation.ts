import type { IRACPayload } from '@avocat-ai/shared';

export interface EvaluationCheck {
  pass: boolean;
  missing: string[];
  haystack: string;
}

function normalise(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

export function buildEvaluationHaystack(payload: IRACPayload): string {
  const segments: string[] = [];
  segments.push(payload.issue);
  segments.push(payload.application);
  segments.push(payload.conclusion);
  for (const rule of payload.rules) {
    segments.push(rule.citation);
    segments.push(rule.source_url);
  }
  for (const citation of payload.citations) {
    segments.push(citation.title);
    segments.push(citation.court_or_publisher);
    segments.push(citation.url);
    if (citation.note) {
      segments.push(citation.note);
    }
  }
  segments.push(payload.risk.level);
  segments.push(payload.risk.why);
  return normalise(segments.join(' \n '));
}

export function evaluateExpectedTerms(payload: IRACPayload, expected: string[] = []): EvaluationCheck {
  const haystack = buildEvaluationHaystack(payload);
  const missing = expected
    .filter((term) => term && term.trim().length > 0)
    .map((term) => normalise(term))
    .filter((term) => !haystack.includes(term));

  return {
    pass: missing.length === 0,
    missing,
    haystack,
  };
}

