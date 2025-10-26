import { z } from 'zod';
import type { OpenAIClientConfig } from './client.js';

export const SUMMARISATION_CLIENT_TAGS: Pick<OpenAIClientConfig, 'cacheKeySuffix' | 'requestTags'> = {
  cacheKeySuffix: 'summaries',
  requestTags:
    process.env.OPENAI_REQUEST_TAGS_SUMMARIES ??
    process.env.OPENAI_REQUEST_TAGS ??
    'service=api,component=summarisation',
};

export const LEGAL_DOCUMENT_SUMMARY_JSON_SCHEMA = {
  name: 'LegalDocumentSummary',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'highlights'],
    properties: {
      summary: {
        type: 'string',
        description:
          "Résumé exécutif en français (3 à 5 phrases) mettant en avant l’objet, la portée et les dates clés du document.",
      },
      highlights: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['heading', 'detail'],
          properties: {
            heading: { type: 'string' },
            detail: { type: 'string' },
          },
        },
      },
    },
  },
  strict: true,
} as const;

const LegalDocumentSummaryResultSchema = z.object({
  summary: z.string().min(1),
  highlights: z
    .array(z.object({ heading: z.string(), detail: z.string() }))
    .min(1)
    .transform((items) => items.map((item) => ({ heading: item.heading.trim(), detail: item.detail.trim() }))),
});

export type LegalDocumentSummaryResult = z.infer<typeof LegalDocumentSummaryResultSchema>;

export function parseLegalDocumentSummaryPayload(payload: string): LegalDocumentSummaryResult {
  const trimmed = payload?.trim();
  if (!trimmed) {
    throw new Error('Synthèse JSON invalide');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error('Synthèse JSON invalide');
  }

  try {
    const result = LegalDocumentSummaryResultSchema.parse(parsed);
    return {
      summary: result.summary.trim(),
      highlights: result.highlights.filter((highlight) => highlight.heading.length > 0 && highlight.detail.length > 0),
    };
  } catch (error) {
    throw new Error('Synthèse JSON invalide');
  }
}
