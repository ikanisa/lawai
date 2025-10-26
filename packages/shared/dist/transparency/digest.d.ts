export interface TransparencyOperations {
    totalRuns?: number | null;
    highRiskRuns?: number | null;
    confidentialRuns?: number | null;
    averageLatencyMs?: number | null;
    medianLatencyMs?: number | null;
    hitlTriggered?: number | null;
    hitl?: {
        total?: number | null;
        pending?: number | null;
        resolved?: number | null;
        medianResponseMinutes?: number | null;
    } | null;
}
export interface TransparencyCompliance {
    friaRequiredRuns?: number | null;
    cepejPassRate?: number | null;
    cepejViolations?: Record<string, number> | null;
    assessedRuns?: number | null;
    violationRuns?: number | null;
}
export interface TransparencyIngestion {
    total?: number | null;
    succeeded?: number | null;
    failed?: number | null;
}
export interface TransparencyEvaluations {
    total?: number | null;
    passRate?: number | null;
}
export interface TransparencyMetrics {
    operations?: TransparencyOperations | null;
    compliance?: TransparencyCompliance | null;
    ingestion?: TransparencyIngestion | null;
    evaluations?: TransparencyEvaluations | null;
    [key: string]: unknown;
}
export interface TransparencyDigestRecord {
    id: string;
    org_id: string;
    period_start: string | null;
    period_end: string | null;
    generated_at: string;
    distribution_status?: string | null;
    metrics?: TransparencyMetrics | null;
}
export interface TransparencyDigestResult {
    markdown: string;
    summary: string;
}
export interface FormatTransparencyDigestOptions {
    locale?: string;
    heading?: string;
    linkBuilder?: (record: TransparencyDigestRecord) => string;
}
export declare function formatPercent(value: number | null | undefined, locale?: string): string;
export declare function formatCount(value: number | null | undefined): number;
export declare function formatDuration(value: number | null | undefined, locale?: string): string;
export declare function summariseTransparencyReport(record: TransparencyDigestRecord, options?: {
    locale?: string;
    linkBuilder?: (record: TransparencyDigestRecord) => string;
}): string;
export declare function formatTransparencyDigest(reference: Date, reports: TransparencyDigestRecord[], options?: FormatTransparencyDigestOptions): TransparencyDigestResult;
//# sourceMappingURL=digest.d.ts.map