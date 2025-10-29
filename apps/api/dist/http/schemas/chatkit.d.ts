import { z } from '../../core/schema/registry.js';
export declare const createChatSessionSchema: z.ZodObject<{
    orgId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    agentName: z.ZodOptional<z.ZodString>;
    channel: z.ZodOptional<z.ZodEnum<["web", "voice"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    userId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    channel?: "web" | "voice" | undefined;
    agentName?: string | undefined;
}, {
    orgId: string;
    userId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    channel?: "web" | "voice" | undefined;
    agentName?: string | undefined;
}>;
export declare const recordChatEventSchema: z.ZodObject<{
    type: z.ZodString;
    payload: z.ZodOptional<z.ZodUnknown>;
    actorType: z.ZodOptional<z.ZodString>;
    actorId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    payload?: unknown;
    actorId?: string | undefined;
    actorType?: string | undefined;
}, {
    type: string;
    payload?: unknown;
    actorId?: string | undefined;
    actorType?: string | undefined;
}>;
//# sourceMappingURL=chatkit.d.ts.map