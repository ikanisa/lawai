import { z } from 'zod';
declare const highlightSchema: z.ZodObject<{
    heading: z.ZodString;
    detail: z.ZodString;
}, "strict", z.ZodTypeAny, {
    heading: string;
    detail: string;
}, {
    heading: string;
    detail: string;
}>;
export declare const legalDocumentSummarySchema: z.ZodObject<{
    summary: z.ZodString;
    highlights: z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        detail: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        heading: string;
        detail: string;
    }, {
        heading: string;
        detail: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
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
export type LegalDocumentSummary = z.infer<typeof legalDocumentSummarySchema>;
export type LegalDocumentHighlight = z.infer<typeof highlightSchema>;
export declare const legalDocumentSummaryResponseFormat: import("openai/lib/parser").AutoParseableResponseFormat<{
    summary: string;
    highlights: {
        heading: string;
        detail: string;
    }[];
}>;
export declare const legalDocumentSummaryTextFormat: import("openai/lib/parser").AutoParseableTextFormat<{
    summary: string;
    highlights: {
        heading: string;
        detail: string;
    }[];
}>;
export {};
//# sourceMappingURL=summarization.d.ts.map