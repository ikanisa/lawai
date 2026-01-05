import { z } from 'zod';
import { zodResponseFormat, zodTextFormat } from 'openai/helpers/zod';

const highlightSchema = z
  .object({
    heading: z.string().min(1),
    detail: z.string().min(1),
  })
  .strict();

export const legalDocumentSummarySchema = z
  .object({
    summary: z
      .string()
      .min(1)
      .describe(
        "Résumé exécutif en français (3 à 5 phrases) mettant en avant l’objet, la portée et les dates clés du document.",
      ),
    highlights: z.array(highlightSchema).min(1),
  })
  .strict();

export type LegalDocumentSummary = z.infer<typeof legalDocumentSummarySchema>;
export type LegalDocumentHighlight = z.infer<typeof highlightSchema>;

export const legalDocumentSummaryResponseFormat = zodResponseFormat(
  legalDocumentSummarySchema,
  'LegalDocumentSummary',
);

export const legalDocumentSummaryTextFormat = zodTextFormat(
  legalDocumentSummarySchema,
  'LegalDocumentSummary',
);
