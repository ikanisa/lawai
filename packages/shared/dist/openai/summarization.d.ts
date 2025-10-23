import { z } from 'zod';
import type { OpenAIClientConfig } from './client.js';
export declare const SUMMARISATION_CLIENT_TAGS: Pick<OpenAIClientConfig, 'cacheKeySuffix' | 'requestTags'>;
export declare const LEGAL_DOCUMENT_SUMMARY_JSON_SCHEMA: {
    readonly name: "LegalDocumentSummary";
    readonly schema: {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["summary", "highlights"];
        readonly properties: {
            readonly summary: {
                readonly type: "string";
                readonly description: "Résumé exécutif en français (3 à 5 phrases) mettant en avant l’objet, la portée et les dates clés du document.";
            };
            readonly highlights: {
                readonly type: "array";
                readonly minItems: 1;
                readonly items: {
                    readonly type: "object";
                    readonly additionalProperties: false;
                    readonly required: readonly ["heading", "detail"];
                    readonly properties: {
                        readonly heading: {
                            readonly type: "string";
                        };
                        readonly detail: {
                            readonly type: "string";
                        };
                    };
                };
            };
        };
    };
    readonly strict: true;
};
declare const LegalDocumentSummaryResultSchema: z.ZodObject<{
    summary: z.ZodString;
    highlights: z.ZodEffects<z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        detail: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        heading: string;
        detail: string;
    }, {
        heading: string;
        detail: string;
    }>, "many">, {
        heading: string;
        detail: string;
    }[], {
        heading: string;
        detail: string;
    }[]>;
}, "strip", z.ZodTypeAny, {
    summary: string;
    highlights: {
        heading: string;
        detail: string;
    }[];
}, {
    summary: string;
    highlights: {
        heading: string;
        detail: string;
    }[];
}>;
export type LegalDocumentSummaryResult = z.infer<typeof LegalDocumentSummaryResultSchema>;
export declare function parseLegalDocumentSummaryPayload(payload: string): LegalDocumentSummaryResult;
export {};
//# sourceMappingURL=summarization.d.ts.map