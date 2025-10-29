function toMs(start, end) {
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
function median(values) {
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
function toNumeric(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}
export function buildRetrievalMetricsResponse(summaryRow, originRows, hostRows) {
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
    return { summary, origins, hosts };
}
export function buildEvaluationMetricsResponse(summaryRow, jurisdictionRows) {
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
    }));
    jurisdictions.sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction));
    return { summary, jurisdictions };
}
export function summariseRuns(rows) {
    let highRisk = 0;
    let hitlTriggered = 0;
    let confidential = 0;
    const latencies = [];
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
        const latency = toMs(row.started_at, row.finished_at);
        if (latency !== null) {
            latencies.push(latency);
        }
    }
    const totalRuns = rows.length;
    const averageLatencyMs = latencies.length === 0 ? 0 : Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length);
    return {
        totalRuns,
        highRiskRuns: highRisk,
        confidentialRuns: confidential,
        averageLatencyMs,
        medianLatencyMs: median(latencies),
        hitlTriggered,
    };
}
export function summariseHitl(rows) {
    let pending = 0;
    let resolved = 0;
    const responseMinutes = [];
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
export function summariseIngestion(rows) {
    let succeeded = 0;
    let failed = 0;
    for (const row of rows) {
        const status = row.status?.toLowerCase() ?? '';
        if (status === 'succeeded' || status === 'success') {
            succeeded += 1;
        }
        else if (status.length > 0) {
            failed += 1;
        }
    }
    return {
        total: rows.length,
        succeeded,
        failed,
    };
}
export function summariseEvaluations(rows) {
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
export function summariseCepej(records) {
    const violations = {};
    let passed = 0;
    let violationRuns = 0;
    let friaRequired = 0;
    for (const record of records) {
        if (record.fria_required) {
            friaRequired += 1;
        }
        if (record.cepej_passed) {
            passed += 1;
            continue;
        }
        violationRuns += 1;
        const items = Array.isArray(record.cepej_violations) ? record.cepej_violations : [];
        for (const violation of items) {
            const key = violation ?? 'unknown';
            violations[key] = (violations[key] ?? 0) + 1;
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
    };
}
export function summariseSlo(records) {
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
    const sorted = [...records].sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());
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
        .filter((value) => typeof value === 'number' && Number.isFinite(value));
    const percentile = (values) => {
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
export function buildTransparencyReport(input) {
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
export function mapLearningReports(rows) {
    return rows.map((row) => ({
        kind: (row.kind ?? 'unknown'),
        reportDate: row.report_date,
        createdAt: row.created_at,
        payload: typeof row.payload === 'object' && row.payload !== null ? row.payload : {},
    }));
}
