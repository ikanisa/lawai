export type AuditPayload = {
    orgId: string;
    actorId?: string | null;
    kind: string;
    object: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
};
export declare function logAuditEvent({ orgId, actorId, kind, object, before, after, metadata, }: AuditPayload): Promise<void>;
//# sourceMappingURL=audit.d.ts.map