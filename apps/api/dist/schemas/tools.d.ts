import { z } from 'zod';
export declare const ToolInvocationLogSchema: z.ZodObject<{
    name: z.ZodString;
    args: z.ZodUnknown;
    output: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    name: string;
    args?: unknown;
    output?: unknown;
}, {
    name: string;
    args?: unknown;
    output?: unknown;
}>;
export declare const ToolInvocationLogsSchema: z.ZodArray<z.ZodObject<{
    name: z.ZodString;
    args: z.ZodUnknown;
    output: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    name: string;
    args?: unknown;
    output?: unknown;
}, {
    name: string;
    args?: unknown;
    output?: unknown;
}>, "many">;
//# sourceMappingURL=tools.d.ts.map