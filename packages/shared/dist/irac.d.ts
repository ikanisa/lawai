import { z } from 'zod';
export declare const IRACSchema: z.ZodObject<{
    jurisdiction: z.ZodObject<{
        country: z.ZodString;
        eu: z.ZodBoolean;
        ohada: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        ohada: boolean;
        eu: boolean;
        country: string;
    }, {
        ohada: boolean;
        eu: boolean;
        country: string;
    }>;
    issue: z.ZodString;
    rules: z.ZodArray<z.ZodObject<{
        citation: z.ZodString;
        source_url: z.ZodString;
        binding: z.ZodBoolean;
        effective_date: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        citation: string;
        source_url: string;
        binding: boolean;
        effective_date: string;
    }, {
        citation: string;
        source_url: string;
        binding: boolean;
        effective_date: string;
    }>, "many">;
    application: z.ZodString;
    conclusion: z.ZodString;
    citations: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        court_or_publisher: z.ZodString;
        date: z.ZodString;
        url: z.ZodString;
        note: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        date: string;
        title: string;
        court_or_publisher: string;
        url: string;
        note: string;
    }, {
        date: string;
        title: string;
        court_or_publisher: string;
        url: string;
        note?: string | undefined;
    }>, "many">;
    risk: z.ZodObject<{
        level: z.ZodEnum<["LOW", "MEDIUM", "HIGH"]>;
        why: z.ZodString;
        hitl_required: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        level: "LOW" | "MEDIUM" | "HIGH";
        why: string;
        hitl_required: boolean;
    }, {
        level: "LOW" | "MEDIUM" | "HIGH";
        why: string;
        hitl_required: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    jurisdiction: {
        ohada: boolean;
        eu: boolean;
        country: string;
    };
    issue: string;
    rules: {
        citation: string;
        source_url: string;
        binding: boolean;
        effective_date: string;
    }[];
    application: string;
    conclusion: string;
    citations: {
        date: string;
        title: string;
        court_or_publisher: string;
        url: string;
        note: string;
    }[];
    risk: {
        level: "LOW" | "MEDIUM" | "HIGH";
        why: string;
        hitl_required: boolean;
    };
}, {
    jurisdiction: {
        ohada: boolean;
        eu: boolean;
        country: string;
    };
    issue: string;
    rules: {
        citation: string;
        source_url: string;
        binding: boolean;
        effective_date: string;
    }[];
    application: string;
    conclusion: string;
    citations: {
        date: string;
        title: string;
        court_or_publisher: string;
        url: string;
        note?: string | undefined;
    }[];
    risk: {
        level: "LOW" | "MEDIUM" | "HIGH";
        why: string;
        hitl_required: boolean;
    };
}>;
export type IRACPayload = z.infer<typeof IRACSchema>;
//# sourceMappingURL=irac.d.ts.map