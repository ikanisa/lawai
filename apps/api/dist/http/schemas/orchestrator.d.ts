import { z } from '../../core/schema/registry.js';
export declare const orchestratorCommandSchema: z.ZodObject<{
    orgId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
    commandType: z.ZodString;
    payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    priority: z.ZodOptional<z.ZodNumber>;
    scheduledFor: z.ZodOptional<z.ZodString>;
    worker: z.ZodOptional<z.ZodEnum<["director", "safety", "domain"]>>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    commandType: string;
    payload?: Record<string, unknown> | undefined;
    priority?: number | undefined;
    worker?: "director" | "safety" | "domain" | undefined;
    sessionId?: string | undefined;
    scheduledFor?: string | undefined;
}, {
    orgId: string;
    commandType: string;
    payload?: Record<string, unknown> | undefined;
    priority?: number | undefined;
    worker?: "director" | "safety" | "domain" | undefined;
    sessionId?: string | undefined;
    scheduledFor?: string | undefined;
}>;
export declare const orchestratorConnectorSchema: z.ZodObject<{
    orgId: z.ZodString;
    connectorType: z.ZodEnum<["erp", "tax", "accounting", "compliance", "analytics"]>;
    name: z.ZodString;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    status: z.ZodOptional<z.ZodEnum<["inactive", "pending", "active", "error"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    name: string;
    connectorType: "erp" | "tax" | "accounting" | "compliance" | "analytics";
    status?: "error" | "pending" | "inactive" | "active" | undefined;
    config?: Record<string, unknown> | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    orgId: string;
    name: string;
    connectorType: "erp" | "tax" | "accounting" | "compliance" | "analytics";
    status?: "error" | "pending" | "inactive" | "active" | undefined;
    config?: Record<string, unknown> | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const orchestratorJobClaimSchema: z.ZodObject<{
    orgId: z.ZodString;
    worker: z.ZodDefault<z.ZodEnum<["director", "safety", "domain"]>>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    worker: "director" | "safety" | "domain";
}, {
    orgId: string;
    worker?: "director" | "safety" | "domain" | undefined;
}>;
export declare const orchestratorJobResultSchema: z.ZodObject<{
    status: z.ZodEnum<["completed", "failed", "cancelled"]>;
    result: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    error: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "completed" | "cancelled";
    error?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    result?: Record<string, unknown> | undefined;
}, {
    status: "failed" | "completed" | "cancelled";
    error?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    result?: Record<string, unknown> | undefined;
}>;
//# sourceMappingURL=orchestrator.d.ts.map