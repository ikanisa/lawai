import { z } from 'zod';
export declare const workspaceQuerySchema: z.ZodObject<{
    orgId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    orgId: string;
}, {
    orgId: string;
}>;
export declare const complianceAcknowledgementBodySchema: z.ZodEffects<z.ZodObject<{
    consent: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        type: z.ZodString;
        version: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: string;
        version: string;
    }, {
        type: string;
        version: string;
    }>>>;
    councilOfEurope: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        version: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: string;
    }, {
        version: string;
    }>>>;
}, "strip", z.ZodTypeAny, {
    consent?: {
        type: string;
        version: string;
    } | null | undefined;
    councilOfEurope?: {
        version: string;
    } | null | undefined;
}, {
    consent?: {
        type: string;
        version: string;
    } | null | undefined;
    councilOfEurope?: {
        version: string;
    } | null | undefined;
}>, {
    consent?: {
        type: string;
        version: string;
    } | null | undefined;
    councilOfEurope?: {
        version: string;
    } | null | undefined;
}, {
    consent?: {
        type: string;
        version: string;
    } | null | undefined;
    councilOfEurope?: {
        version: string;
    } | null | undefined;
}>;
export declare const complianceStatusQuerySchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    limit?: number | undefined;
}, {
    limit?: number | undefined;
}>;
export type WorkspaceQuery = z.infer<typeof workspaceQuerySchema>;
export type ComplianceAcknowledgementBody = z.infer<typeof complianceAcknowledgementBodySchema>;
export type ComplianceStatusQuery = z.infer<typeof complianceStatusQuerySchema>;
//# sourceMappingURL=schemas.d.ts.map