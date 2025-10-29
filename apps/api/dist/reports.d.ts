type NullableDate = string | null;
export interface CepejRecord {
    cepej_passed: boolean;
    cepej_violations: string[] | null;
    fria_required: boolean;
    created_at: string;
}
export interface RunRecord {
    risk_level: string | null;
    hitl_required: boolean | null;
    started_at: string;
    finished_at: NullableDate;
    confidential_mode?: boolean | null;
}
export interface HitlRecord {
    status: string;
    created_at: string;
    updated_at: NullableDate;
}
export interface IngestionRecord {
    status: string;
    started_at: string;
    inserted_count?: number | null;
    failed_count?: number | null;
}
export interface EvaluationRecord {
    pass: boolean | null;
    created_at: string;
}
export interface TransparencyInputs {
    organisation: {
        id: string;
        name: string;
    };
    timeframe: {
        start: string;
        end: string;
    };
    runs: RunSummary;
    hitl: HitlSummary;
    ingestion: IngestionSummary;
    evaluations: EvaluationSummary;
    cepej: CepejSummary;
}
export interface RunSummary {
    totalRuns: number;
    highRiskRuns: number;
    confidentialRuns: number;
    averageLatencyMs: number;
    medianLatencyMs: number | null;
    hitlTriggered: number;
}
export interface HitlSummary {
    total: number;
    pending: number;
    resolved: number;
    medianResponseMinutes: number | null;
}
export interface IngestionSummary {
    total: number;
    succeeded: number;
    failed: number;
}
export interface EvaluationSummary {
    total: number;
    passRate: number | null;
}
export interface CepejSummary {
    assessedRuns: number;
    passedRuns: number;
    violationRuns: number;
    friaRequiredRuns: number;
    passRate: number | null;
    violations: Record<string, number>;
}
export interface RetrievalSummary {
    runsTotal: number;
    avgLocalSnippets: number | null;
    avgFileSnippets: number | null;
    allowlistedRatio: number | null;
    runsWithTranslationWarnings: number;
    runsWithoutCitations: number;
    lastRunAt: string | null;
}
export interface RetrievalOriginMetric {
    origin: 'local' | 'file_search' | string;
    snippetCount: number;
    avgSimilarity: number | null;
    avgWeight: number | null;
}
export interface RetrievalHostMetric {
    host: string;
    citationCount: number;
    allowlistedCount: number;
    translationWarnings: number;
    lastCitedAt: string | null;
}
export interface RetrievalMetricsResponse {
    summary: RetrievalSummary | null;
    origins: RetrievalOriginMetric[];
    hosts: RetrievalHostMetric[];
}
export interface EvaluationMetricsSummary {
    totalCases: number;
    evaluatedResults: number;
    passRate: number | null;
    citationPrecisionP95: number | null;
    temporalValidityP95: number | null;
    citationPrecisionCoverage: number | null;
    temporalValidityCoverage: number | null;
    maghrebBannerCoverage: number | null;
    lastResultAt: string | null;
}
export interface EvaluationJurisdictionMetric {
    jurisdiction: string;
    evaluationCount: number;
    passRate: number | null;
    citationPrecisionMedian: number | null;
    temporalValidityMedian: number | null;
    avgBindingWarnings: number | null;
    maghrebBannerCoverage: number | null;
}
export interface EvaluationMetricsResponse {
    summary: EvaluationMetricsSummary | null;
    jurisdictions: EvaluationJurisdictionMetric[];
}
export interface RetrievalSummaryRow {
    runs_total: number | null;
    avg_local_snippets: unknown;
    avg_file_snippets: unknown;
    allowlisted_ratio: unknown;
    runs_with_translation_warnings: number | null;
    runs_without_citations: number | null;
    last_run_at: string | null;
}
export interface RetrievalOriginRow {
    origin: string | null;
    snippet_count: number | null;
    avg_similarity: unknown;
    avg_weight: unknown;
}
export interface RetrievalHostRow {
    host: string | null;
    citation_count: number | null;
    allowlisted_count: number | null;
    translation_warnings: number | null;
    last_cited_at: string | null;
}
export interface EvaluationMetricsSummaryRow {
    total_cases: number | null;
    evaluated_results: number | null;
    pass_rate: unknown;
    citation_precision_p95: unknown;
    temporal_validity_p95: unknown;
    citation_precision_coverage: unknown;
    temporal_validity_coverage: unknown;
    maghreb_banner_coverage: unknown;
    last_result_at: string | null;
}
export interface EvaluationJurisdictionRow {
    jurisdiction: string | null;
    evaluation_count: number | null;
    pass_rate: unknown;
    citation_precision_median: unknown;
    temporal_validity_median: unknown;
    avg_binding_warnings: unknown;
    maghreb_banner_coverage: unknown;
}
export interface SloSnapshotRecord {
    captured_at: string;
    api_uptime_percent: number;
    hitl_response_p95_seconds: number;
    retrieval_latency_p95_seconds: number;
    citation_precision_p95: number | null;
    notes: string | null;
}
export interface SloSummary {
    snapshots: number;
    latestCapture: string | null;
    apiUptimeP95: number | null;
    hitlResponseP95Seconds: number | null;
    retrievalLatencyP95Seconds: number | null;
    citationPrecisionP95: number | null;
}
export declare function buildRetrievalMetricsResponse(summaryRow: RetrievalSummaryRow | null, originRows: RetrievalOriginRow[], hostRows: RetrievalHostRow[]): RetrievalMetricsResponse;
export declare function buildEvaluationMetricsResponse(summaryRow: EvaluationMetricsSummaryRow | null, jurisdictionRows: EvaluationJurisdictionRow[]): EvaluationMetricsResponse;
export declare function summariseRuns(rows: RunRecord[]): RunSummary;
export declare function summariseHitl(rows: HitlRecord[]): HitlSummary;
export declare function summariseIngestion(rows: IngestionRecord[]): IngestionSummary;
export declare function summariseEvaluations(rows: EvaluationRecord[]): EvaluationSummary;
export declare function summariseCepej(records: CepejRecord[]): CepejSummary;
export declare function summariseSlo(records: SloSnapshotRecord[]): SloSummary;
export declare function buildTransparencyReport(input: TransparencyInputs): {
    organisation: {
        id: string;
        name: string;
    };
    timeframe: {
        start: string;
        end: string;
    };
    operations: {
        totalRuns: number;
        highRiskRuns: number;
        confidentialRuns: number;
        averageLatencyMs: number;
        medianLatencyMs: number | null;
        hitlTriggered: number;
        hitl: {
            total: number;
            pending: number;
            resolved: number;
            medianResponseMinutes: number | null;
        };
    };
    compliance: {
        friaRequiredRuns: number;
        cepejPassRate: number | null;
        cepejViolations: Record<string, number>;
        assessedRuns: number;
        violationRuns: number;
    };
    ingestion: {
        total: number;
        succeeded: number;
        failed: number;
    };
    evaluations: {
        total: number;
        passRate: number | null;
    };
};
export type TransparencyReportPayload = ReturnType<typeof buildTransparencyReport>;
export interface LearningReportRow {
    kind: string | null;
    report_date: string;
    payload: unknown;
    created_at: string;
}
export interface LearningReportItem {
    kind: 'drift' | 'evaluation' | 'queue' | string;
    reportDate: string;
    createdAt: string;
    payload: Record<string, unknown>;
}
export declare function mapLearningReports(rows: LearningReportRow[]): LearningReportItem[];
export {};
//# sourceMappingURL=reports.d.ts.map