type NullableDate = string | null;

export interface CepejRecord {
  cepej_passed: boolean;
  cepej_violations: string[] | null;
  fria_required: boolean;
  created_at: string;
  statute_passed?: boolean | null;
  statute_violations?: string[] | null;
  disclosures_missing?: string[] | null;
}

export interface RunRecord {
  risk_level: string | null;
  hitl_required: boolean | null;
  started_at: string;
  finished_at: NullableDate;
  confidential_mode?: boolean | null;
  agent_code?: string | null;
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
  organisation: { id: string; name: string };
  timeframe: { start: string; end: string };
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
  agentsByCode: Array<{ code: string; count: number }>;
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
  statuteAlerts: number;
  statuteBreakdown: Record<string, number>;
  disclosureAlerts: number;
  disclosureBreakdown: Record<string, number>;
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

export interface RetrievalJurisdictionMetric {
  jurisdiction: string;
  runCount: number;
  allowlistedRatio: number | null;
  translationWarnings: number;
  snippetCount: number;
  avgWeight: number | null;
  hitlRate: number | null;
  highRiskRate: number | null;
}

export interface RetrievalFairnessTrend {
  capturedAt: string | null;
  overallHitlRate: number | null;
  jurisdictions: Array<{
    jurisdiction: string;
    totalRuns: number;
    hitlRate: number | null;
    highRiskShare: number | null;
    benchmarkRate: number | null;
    synonyms?: { terms: number; expansions: number } | null;
    flagged: boolean;
  }>;
  flagged: { jurisdictions: string[]; benchmarks: string[]; synonyms: string[] };
}

export interface RetrievalMetricsResponse {
  summary: RetrievalSummary | null;
  origins: RetrievalOriginMetric[];
  hosts: RetrievalHostMetric[];
  jurisdictions: RetrievalJurisdictionMetric[];
  fairness: RetrievalFairnessTrend | null;
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
  rwandaNoticeCoverage: number | null;
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
  rwandaNoticeCoverage: number | null;
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
  rwanda_notice_coverage: unknown;
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
  rwanda_notice_coverage: unknown;
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

function toMs(start: string, end: NullableDate): number | null {
  if (!end) {
    return null;
  }
  const startDate = new Date(start).getTime();
  const endDate = new Date(end).getTime();
  if (Number.isNaN(startDate) || Number.isNaN(endDate)) {
    return null;
  }
  return Math.max(endDate - startDate, 0);
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

function toNumeric(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normaliseFairnessTrend(
  row: { payload?: unknown; report_date?: string | null } | null,
): RetrievalFairnessTrend | null {
  if (!row || !row.payload || typeof row.payload !== 'object') {
    return null;
  }
  const payload = row.payload as Record<string, unknown>;
  const capturedAt =
    typeof payload.capturedAt === 'string'
      ? payload.capturedAt
      : typeof row.report_date === 'string'
        ? row.report_date
        : null;
  const overall =
    payload.overall && typeof payload.overall === 'object' ? (payload.overall as Record<string, unknown>) : null;
  const overallHitlRate = overall ? toNumeric(overall.hitlRate) : null;
  const jurisdictionEntries = Array.isArray(payload.jurisdictions)
    ? (payload.jurisdictions as Array<Record<string, unknown>>)
    : [];
  const flaggedPayload =
    payload.flagged && typeof payload.flagged === 'object'
      ? (payload.flagged as { jurisdictions?: unknown; benchmarks?: unknown; synonyms?: unknown })
      : null;

  const jurisdictions = jurisdictionEntries.map((entry) => {
    const jurisdiction =
      typeof entry.code === 'string'
        ? entry.code
        : typeof entry.jurisdiction === 'string'
          ? entry.jurisdiction
          : 'UNKNOWN';
    const totalRuns = typeof entry.totalRuns === 'number' ? entry.totalRuns : Number(entry.totalRuns ?? 0);
    const hitlRate = toNumeric(entry.hitlRate);
    const highRiskShare = toNumeric(entry.highRiskShare);
    const benchmarkRate = toNumeric(entry.benchmarkRate);
    const synonymsPayload =
      entry.synonyms && typeof entry.synonyms === 'object' ? (entry.synonyms as Record<string, unknown>) : null;
    const synonyms = synonymsPayload
      ? {
          terms: typeof synonymsPayload.terms === 'number' ? synonymsPayload.terms : Number(synonymsPayload.terms ?? 0),
          expansions:
            typeof synonymsPayload.expansions === 'number'
              ? synonymsPayload.expansions
              : Number(synonymsPayload.expansions ?? 0),
        }
      : null;
    return {
      jurisdiction,
      totalRuns,
      hitlRate,
      highRiskShare,
      benchmarkRate,
      synonyms,
      flagged: Boolean(
        Array.isArray(flaggedPayload?.jurisdictions) &&
          ((flaggedPayload?.jurisdictions as string[]) ?? []).includes(jurisdiction),
      ),
    };
  });

  const flagged = flaggedPayload ?? { jurisdictions: [], benchmarks: [], synonyms: [] };

  return {
    capturedAt,
    overallHitlRate,
    jurisdictions,
    flagged: {
      jurisdictions: Array.isArray(flagged.jurisdictions)
        ? (flagged.jurisdictions as string[])
        : [],
      benchmarks: Array.isArray(flagged.benchmarks) ? (flagged.benchmarks as string[]) : [],
      synonyms: Array.isArray(flagged.synonyms) ? (flagged.synonyms as string[]) : [],
    },
  };
}

export function buildRetrievalMetricsResponse(
  summaryRow: RetrievalSummaryRow | null,
  originRows: RetrievalOriginRow[],
  hostRows: RetrievalHostRow[],
  jurisdictionMetrics: RetrievalJurisdictionMetric[],
  fairnessRow: { payload?: unknown; report_date?: string | null } | null,
): RetrievalMetricsResponse {
  const summary = summaryRow
    ? {
        runsTotal: summaryRow.runs_total ?? 0,
        avgLocalSnippets: toNumeric(summaryRow.avg_local_snippets),
        avgFileSnippets: toNumeric(summaryRow.avg_file_snippets),
        allowlistedRatio: toNumeric(summaryRow.allowlisted_ratio),
        runsWithTranslationWarnings: summaryRow.runs_with_translation_warnings ?? 0,
        runsWithoutCitations: summaryRow.runs_without_citations ?? 0,
        lastRunAt: summaryRow.last_run_at,
      }
    : null;

  const origins = originRows.map((row) => ({
    origin: row.origin ?? 'unknown',
    snippetCount: row.snippet_count ?? 0,
    avgSimilarity: toNumeric(row.avg_similarity),
    avgWeight: toNumeric(row.avg_weight),
  }));

  const hosts = hostRows.map((row) => ({
    host: row.host ?? 'unknown',
    citationCount: row.citation_count ?? 0,
    allowlistedCount: row.allowlisted_count ?? 0,
    translationWarnings: row.translation_warnings ?? 0,
    lastCitedAt: row.last_cited_at,
  }));

  const fairness = normaliseFairnessTrend(fairnessRow);

  return { summary, origins, hosts, jurisdictions: jurisdictionMetrics, fairness };
}

export function buildEvaluationMetricsResponse(
  summaryRow: EvaluationMetricsSummaryRow | null,
  jurisdictionRows: EvaluationJurisdictionRow[],
): EvaluationMetricsResponse {
  const summary = summaryRow
    ? {
        totalCases: summaryRow.total_cases ?? 0,
        evaluatedResults: summaryRow.evaluated_results ?? 0,
        passRate: toNumeric(summaryRow.pass_rate),
        citationPrecisionP95: toNumeric(summaryRow.citation_precision_p95),
        temporalValidityP95: toNumeric(summaryRow.temporal_validity_p95),
        citationPrecisionCoverage: toNumeric(summaryRow.citation_precision_coverage),
        temporalValidityCoverage: toNumeric(summaryRow.temporal_validity_coverage),
        maghrebBannerCoverage: toNumeric(summaryRow.maghreb_banner_coverage),
        rwandaNoticeCoverage: toNumeric(summaryRow.rwanda_notice_coverage),
        lastResultAt: summaryRow.last_result_at ?? null,
      }
    : null;

  const jurisdictions = jurisdictionRows.map((row) => ({
    jurisdiction: row.jurisdiction && row.jurisdiction.length > 0 ? row.jurisdiction : 'UNKNOWN',
    evaluationCount: row.evaluation_count ?? 0,
    passRate: toNumeric(row.pass_rate),
    citationPrecisionMedian: toNumeric(row.citation_precision_median),
    temporalValidityMedian: toNumeric(row.temporal_validity_median),
    avgBindingWarnings: toNumeric(row.avg_binding_warnings),
    maghrebBannerCoverage: toNumeric(row.maghreb_banner_coverage),
    rwandaNoticeCoverage: toNumeric(row.rwanda_notice_coverage),
  }));

  jurisdictions.sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction));

  return { summary, jurisdictions };
}

export function summariseRuns(rows: RunRecord[]): RunSummary {
  let highRisk = 0;
  let hitlTriggered = 0;
  let confidential = 0;
  const latencies: number[] = [];
  const agentCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.risk_level === 'HIGH') {
      highRisk += 1;
    }
    if (row.hitl_required) {
      hitlTriggered += 1;
    }
    if (row.confidential_mode) {
      confidential += 1;
    }
    const agentCodeRaw = typeof row.agent_code === 'string' ? row.agent_code.trim() : '';
    const agentCode = agentCodeRaw.length > 0 ? agentCodeRaw : 'unspecified';
    agentCounts.set(agentCode, (agentCounts.get(agentCode) ?? 0) + 1);
    const latency = toMs(row.started_at, row.finished_at);
    if (latency !== null) {
      latencies.push(latency);
    }
  }

  const totalRuns = rows.length;
  const averageLatencyMs = latencies.length === 0 ? 0 : Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length);
  const agentsByCode = Array.from(agentCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => (b.count - a.count) || a.code.localeCompare(b.code));

  return {
    totalRuns,
    highRiskRuns: highRisk,
    confidentialRuns: confidential,
    averageLatencyMs,
    medianLatencyMs: median(latencies),
    hitlTriggered,
    agentsByCode,
  };
}

export function summariseHitl(rows: HitlRecord[]): HitlSummary {
  let pending = 0;
  let resolved = 0;
  const responseMinutes: number[] = [];

  for (const row of rows) {
    const status = row.status?.toLowerCase() ?? 'pending';
    if (status === 'pending') {
      pending += 1;
      continue;
    }
    resolved += 1;
    const start = new Date(row.created_at).getTime();
    const end = row.updated_at ? new Date(row.updated_at).getTime() : Number.NaN;
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      responseMinutes.push((end - start) / 60000);
    }
  }

  return {
    total: rows.length,
    pending,
    resolved,
    medianResponseMinutes: responseMinutes.length === 0 ? null : Math.round((median(responseMinutes) ?? 0) * 100) / 100,
  };
}

export function summariseIngestion(rows: IngestionRecord[]): IngestionSummary {
  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    const status = row.status?.toLowerCase() ?? '';
    if (status === 'succeeded' || status === 'success') {
      succeeded += 1;
    } else if (status.length > 0) {
      failed += 1;
    }
  }

  return {
    total: rows.length,
    succeeded,
    failed,
  };
}

export function summariseEvaluations(rows: EvaluationRecord[]): EvaluationSummary {
  if (rows.length === 0) {
    return { total: 0, passRate: null };
  }

  let passes = 0;
  for (const row of rows) {
    if (row.pass === true) {
      passes += 1;
    }
  }

  return {
    total: rows.length,
    passRate: passes === 0 ? (rows.length === 0 ? null : 0) : Math.round((passes / rows.length) * 1000) / 1000,
  };
}

export function summariseCepej(records: CepejRecord[]): CepejSummary {
  const violations: Record<string, number> = {};
  const statuteBreakdown: Record<string, number> = {};
  const disclosureBreakdown: Record<string, number> = {};
  let passed = 0;
  let violationRuns = 0;
  let friaRequired = 0;
  let statuteAlerts = 0;
  let disclosureAlerts = 0;

  for (const record of records) {
    if (record.fria_required) {
      friaRequired += 1;
    }
    if (record.cepej_passed) {
      passed += 1;
    } else {
      violationRuns += 1;
      const items = Array.isArray(record.cepej_violations) ? record.cepej_violations : [];
      for (const violation of items) {
        const key = violation ?? 'unknown';
        violations[key] = (violations[key] ?? 0) + 1;
      }
    }

    if (record.statute_passed === false) {
      statuteAlerts += 1;
      const items = Array.isArray(record.statute_violations) ? record.statute_violations : [];
      if (items.length === 0) {
        statuteBreakdown.unknown = (statuteBreakdown.unknown ?? 0) + 1;
      } else {
        for (const item of items) {
          const key = item ?? 'unknown';
          statuteBreakdown[key] = (statuteBreakdown[key] ?? 0) + 1;
        }
      }
    }

    const disclosures = Array.isArray(record.disclosures_missing) ? record.disclosures_missing : [];
    if (disclosures.length > 0) {
      disclosureAlerts += 1;
      for (const item of disclosures) {
        const key = item ?? 'unknown';
        disclosureBreakdown[key] = (disclosureBreakdown[key] ?? 0) + 1;
      }
    }
  }

  const assessedRuns = records.length;
  const passRate = assessedRuns === 0 ? null : Math.round((passed / assessedRuns) * 1000) / 1000;

  return {
    assessedRuns,
    passedRuns: passed,
    violationRuns,
    friaRequiredRuns: friaRequired,
    passRate,
    violations,
    statuteAlerts,
    statuteBreakdown,
    disclosureAlerts,
    disclosureBreakdown,
  };
}

export function summariseSlo(records: SloSnapshotRecord[]): SloSummary {
  if (records.length === 0) {
    return {
      snapshots: 0,
      latestCapture: null,
      apiUptimeP95: null,
      hitlResponseP95Seconds: null,
      retrievalLatencyP95Seconds: null,
      citationPrecisionP95: null,
    };
  }

  const sorted = [...records].sort(
    (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime(),
  );
  const latest = sorted[0];
  const uptimeValues = sorted
    .map((row) => row.api_uptime_percent)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  const hitlValues = sorted
    .map((row) => row.hitl_response_p95_seconds)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  const retrievalValues = sorted
    .map((row) => row.retrieval_latency_p95_seconds)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  const citationValues = sorted
    .map((row) => row.citation_precision_p95)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  const percentile = (values: number[]): number | null => {
    if (values.length === 0) {
      return null;
    }
    const ordered = [...values].sort((a, b) => a - b);
    const index = Math.floor((ordered.length - 1) * 0.95);
    return Math.round(ordered[index] * 100) / 100;
  };

  return {
    snapshots: records.length,
    latestCapture: latest.captured_at,
    apiUptimeP95: percentile(uptimeValues),
    hitlResponseP95Seconds: percentile(hitlValues),
    retrievalLatencyP95Seconds: percentile(retrievalValues),
    citationPrecisionP95: percentile(citationValues),
  };
}

export function buildTransparencyReport(input: TransparencyInputs) {
  const timeframe = {
    start: input.timeframe.start,
    end: input.timeframe.end,
  };

  return {
    organisation: input.organisation,
    timeframe,
    operations: {
      totalRuns: input.runs.totalRuns,
      highRiskRuns: input.runs.highRiskRuns,
      confidentialRuns: input.runs.confidentialRuns,
      averageLatencyMs: input.runs.averageLatencyMs,
      medianLatencyMs: input.runs.medianLatencyMs,
      hitlTriggered: input.runs.hitlTriggered,
      agentsByCode: input.runs.agentsByCode,
      hitl: {
        total: input.hitl.total,
        pending: input.hitl.pending,
        resolved: input.hitl.resolved,
        medianResponseMinutes: input.hitl.medianResponseMinutes,
      },
    },
    compliance: {
      friaRequiredRuns: input.cepej.friaRequiredRuns,
      cepejPassRate: input.cepej.passRate,
      cepejViolations: input.cepej.violations,
      assessedRuns: input.cepej.assessedRuns,
      violationRuns: input.cepej.violationRuns,
    },
    ingestion: {
      total: input.ingestion.total,
      succeeded: input.ingestion.succeeded,
      failed: input.ingestion.failed,
    },
    evaluations: {
      total: input.evaluations.total,
      passRate: input.evaluations.passRate,
    },
  };
}

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

export function mapLearningReports(rows: LearningReportRow[]): LearningReportItem[] {
  return rows.map((row) => ({
    kind: (row.kind ?? 'unknown') as LearningReportItem['kind'],
    reportDate: row.report_date,
    createdAt: row.created_at,
    payload: typeof row.payload === 'object' && row.payload !== null ? (row.payload as Record<string, unknown>) : {},
  }));
}
