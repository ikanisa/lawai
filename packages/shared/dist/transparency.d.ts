export interface TransparencyOperationsMetrics {
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
    [key: string]: unknown;
}
export interface TransparencyComplianceMetrics {
    friaRequiredRuns?: number | null;
    cepejPassRate?: number | null;
    cepejViolations?: Record<string, number> | null;
    assessedRuns?: number | null;
    violationRuns?: number | null;
    [key: string]: unknown;
}
export interface TransparencyIngestionMetrics {
    total?: number | null;
    succeeded?: number | null;
    failed?: number | null;
    [key: string]: unknown;
}
export interface TransparencyEvaluationMetrics {
    total?: number | null;
    passRate?: number | null;
    [key: string]: unknown;
}
export interface TransparencyMetrics {
    operations?: TransparencyOperationsMetrics | null;
    compliance?: TransparencyComplianceMetrics | null;
    ingestion?: TransparencyIngestionMetrics | null;
    evaluations?: TransparencyEvaluationMetrics | null;
    [key: string]: unknown;
}
export interface TransparencyReport {
    id: string;
    org_id: string;
    period_start?: string | null;
    period_end?: string | null;
    generated_at?: string | null;
    distribution_status?: string | null;
    metrics?: TransparencyMetrics | null;
}
export interface TransparencyDigestOptions {
    baseUrl?: string;
    locale?: string;
    emptyMessage?: string;
    headerLabel?: string;
}
export declare function formatPercent(value: number | null | undefined, locale?: string): string;
export declare function formatCount(value: number | null | undefined): number;
export declare function formatDuration(minutes: number | null | undefined, locale?: string): string;
export declare function buildReportLink(report: TransparencyReport, baseUrl?: string): string;
export declare function summariseTransparencyReport(report: TransparencyReport, options?: {
    baseUrl?: string;
    locale?: string;
}): string;
export declare function formatTransparencyDigest(reference: Date, reports: TransparencyReport[], options?: TransparencyDigestOptions): {
    markdown: string;
    summary: string;
};
//# sourceMappingURL=transparency.d.ts.map