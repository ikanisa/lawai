import { z } from 'zod';
export declare const IRACRuleSchema: z.ZodObject<{
    citation: z.ZodAny;
    source_url: z.ZodOptional<z.ZodString>;
    binding: z.ZodOptional<z.ZodBoolean>;
    effective_date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    citation?: any;
    source_url?: string | undefined;
    binding?: boolean | undefined;
    effective_date?: string | undefined;
}, {
    citation?: any;
    source_url?: string | undefined;
    binding?: boolean | undefined;
    effective_date?: string | undefined;
}>;
export declare const IRACPayloadSchema: z.ZodObject<{
    question: z.ZodString;
    jurisdiction: z.ZodAny;
    issue: z.ZodOptional<z.ZodString>;
    rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        citation: z.ZodAny;
        source_url: z.ZodOptional<z.ZodString>;
        binding: z.ZodOptional<z.ZodBoolean>;
        effective_date: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        citation?: any;
        source_url?: string | undefined;
        binding?: boolean | undefined;
        effective_date?: string | undefined;
    }, {
        citation?: any;
        source_url?: string | undefined;
        binding?: boolean | undefined;
        effective_date?: string | undefined;
    }>, "many">>;
    application: z.ZodOptional<z.ZodString>;
    conclusion: z.ZodOptional<z.ZodString>;
    citations: z.ZodArray<z.ZodAny, "many">;
    risk: z.ZodObject<{
        level: z.ZodAny;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        level: z.ZodAny;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        level: z.ZodAny;
    }, z.ZodTypeAny, "passthrough">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    question: z.ZodString;
    jurisdiction: z.ZodAny;
    issue: z.ZodOptional<z.ZodString>;
    rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        citation: z.ZodAny;
        source_url: z.ZodOptional<z.ZodString>;
        binding: z.ZodOptional<z.ZodBoolean>;
        effective_date: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        citation?: any;
        source_url?: string | undefined;
        binding?: boolean | undefined;
        effective_date?: string | undefined;
    }, {
        citation?: any;
        source_url?: string | undefined;
        binding?: boolean | undefined;
        effective_date?: string | undefined;
    }>, "many">>;
    application: z.ZodOptional<z.ZodString>;
    conclusion: z.ZodOptional<z.ZodString>;
    citations: z.ZodArray<z.ZodAny, "many">;
    risk: z.ZodObject<{
        level: z.ZodAny;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        level: z.ZodAny;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        level: z.ZodAny;
    }, z.ZodTypeAny, "passthrough">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    question: z.ZodString;
    jurisdiction: z.ZodAny;
    issue: z.ZodOptional<z.ZodString>;
    rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        citation: z.ZodAny;
        source_url: z.ZodOptional<z.ZodString>;
        binding: z.ZodOptional<z.ZodBoolean>;
        effective_date: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        citation?: any;
        source_url?: string | undefined;
        binding?: boolean | undefined;
        effective_date?: string | undefined;
    }, {
        citation?: any;
        source_url?: string | undefined;
        binding?: boolean | undefined;
        effective_date?: string | undefined;
    }>, "many">>;
    application: z.ZodOptional<z.ZodString>;
    conclusion: z.ZodOptional<z.ZodString>;
    citations: z.ZodArray<z.ZodAny, "many">;
    risk: z.ZodObject<{
        level: z.ZodAny;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        level: z.ZodAny;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        level: z.ZodAny;
    }, z.ZodTypeAny, "passthrough">>;
}, z.ZodTypeAny, "passthrough">>;
export type IRACPayloadLike = z.infer<typeof IRACPayloadSchema>;
//# sourceMappingURL=irac.d.ts.map