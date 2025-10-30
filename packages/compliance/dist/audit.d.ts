import type { SupabaseClient } from '@supabase/supabase-js';
export type AuditRecord = {
    orgId: string;
    actorId?: string | null;
    kind: string;
    object: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    residency?: string | null;
};
export interface AuditLoggerOptions {
    redactionPaths?: string[];
    metadataAllowList?: string[];
    defaultResidency?: string | null;
}
export declare class AuditLogger {
    private readonly supabase;
    private readonly options;
    private readonly redact;
    constructor(supabase: SupabaseClient, options?: AuditLoggerOptions);
    private applyRedaction;
    log(record: AuditRecord): Promise<void>;
}
//# sourceMappingURL=audit.d.ts.map