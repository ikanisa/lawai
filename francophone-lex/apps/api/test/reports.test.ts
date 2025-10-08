import { describe, expect, it } from 'vitest';
import {
  buildRetrievalMetricsResponse,
  summariseCepej,
  summariseRuns,
  summariseHitl,
  summariseIngestion,
  summariseEvaluations,
  summariseSlo,
  buildTransparencyReport,
  mapLearningReports,
} from '../src/reports.js';

describe('reports helpers', () => {
  it('summarises CEPEJ metrics with violations', () => {
    const summary = summariseCepej([
      { cepej_passed: true, cepej_violations: null, fria_required: false, created_at: new Date().toISOString() },
      {
        cepej_passed: false,
        cepej_violations: ['transparency', 'quality_security'],
        fria_required: true,
        created_at: new Date().toISOString(),
      },
    ]);

    expect(summary.assessedRuns).toBe(2);
    expect(summary.passedRuns).toBe(1);
    expect(summary.violationRuns).toBe(1);
    expect(summary.friaRequiredRuns).toBe(1);
    expect(summary.passRate).toBeCloseTo(0.5, 3);
    expect(summary.violations).toEqual({ transparency: 1, quality_security: 1 });
  });

  it('builds a transparency payload with computed sections', () => {
    const runs = summariseRuns([
      {
        risk_level: 'HIGH',
        hitl_required: true,
        started_at: new Date('2024-07-01T10:00:00Z').toISOString(),
        finished_at: new Date('2024-07-01T10:00:02Z').toISOString(),
        confidential_mode: true,
        agent_code: 'conseil_recherche',
      },
      {
        risk_level: 'LOW',
        hitl_required: false,
        started_at: new Date('2024-07-02T10:00:00Z').toISOString(),
        finished_at: new Date('2024-07-02T10:00:03Z').toISOString(),
        confidential_mode: false,
        agent_code: 'concierge',
      },
      {
        risk_level: 'LOW',
        hitl_required: false,
        started_at: new Date('2024-07-03T10:00:00Z').toISOString(),
        finished_at: new Date('2024-07-03T10:00:04Z').toISOString(),
        confidential_mode: false,
        agent_code: 'conseil_recherche',
      },
    ]);

    const hitl = summariseHitl([
      { status: 'pending', created_at: new Date().toISOString(), updated_at: null },
      {
        status: 'approved',
        created_at: new Date('2024-07-01T10:00:00Z').toISOString(),
        updated_at: new Date('2024-07-01T10:05:00Z').toISOString(),
      },
    ]);

    const ingestion = summariseIngestion([
      { status: 'succeeded', started_at: new Date().toISOString(), inserted_count: 10, failed_count: 0 },
      { status: 'failed', started_at: new Date().toISOString(), inserted_count: 0, failed_count: 5 },
    ]);

    const evaluations = summariseEvaluations([
      { pass: true, created_at: new Date().toISOString() },
      { pass: false, created_at: new Date().toISOString() },
    ]);

    const cepej = summariseCepej([
      { cepej_passed: true, cepej_violations: null, fria_required: false, created_at: new Date().toISOString() },
    ]);

    const report = buildTransparencyReport({
      organisation: { id: 'org', name: 'Org Test' },
      timeframe: { start: '2024-07-01T00:00:00Z', end: '2024-07-31T23:59:59Z' },
      runs,
      hitl,
      ingestion,
      evaluations,
      cepej,
    });

    expect(report.organisation.name).toBe('Org Test');
    expect(report.operations.totalRuns).toBe(3);
    expect(report.compliance.cepejPassRate).toBe(1);
    expect(report.ingestion.succeeded).toBe(1);
    expect(report.evaluations.passRate).toBeCloseTo(0.5, 3);
    expect(report.operations.agentsByCode).toEqual([
      { code: 'conseil_recherche', count: 2 },
      { code: 'concierge', count: 1 },
    ]);
  });

  it('summarises SLO snapshots', () => {
    const summary = summariseSlo([
      {
        captured_at: '2024-07-01T00:00:00Z',
        api_uptime_percent: 99.9,
        hitl_response_p95_seconds: 180,
        retrieval_latency_p95_seconds: 12,
        citation_precision_p95: 98.5,
        notes: 'baseline',
      },
      {
        captured_at: '2024-07-08T00:00:00Z',
        api_uptime_percent: 99.95,
        hitl_response_p95_seconds: 140,
        retrieval_latency_p95_seconds: 10,
        citation_precision_p95: null,
        notes: 'week 2',
      },
    ]);

    expect(summary.snapshots).toBe(2);
    expect(summary.latestCapture).toBe('2024-07-08T00:00:00Z');
    expect(summary.apiUptimeP95).toBeGreaterThanOrEqual(99.9);
    expect(summary.hitlResponseP95Seconds).toBeGreaterThan(0);
    expect(summary.retrievalLatencyP95Seconds).toBeGreaterThan(0);
  });

  it('builds retrieval metrics with defaults for empty data', () => {
    const metrics = buildRetrievalMetricsResponse(null, [], []);
    expect(metrics.summary).toBeNull();
    expect(metrics.origins).toEqual([]);
    expect(metrics.hosts).toEqual([]);
  });

  it('builds retrieval metrics response from raw view rows', () => {
    const metrics = buildRetrievalMetricsResponse(
      {
        runs_total: 5,
        avg_local_snippets: '2.5',
        avg_file_snippets: '1.5',
        allowlisted_ratio: '0.9',
        runs_with_translation_warnings: 1,
        runs_without_citations: 2,
        last_run_at: '2024-07-01T00:00:00Z',
      },
      [
        { origin: 'local', snippet_count: 4, avg_similarity: '0.8', avg_weight: '0.6' },
        { origin: 'file_search', snippet_count: 2, avg_similarity: '0.7', avg_weight: null },
      ],
      [
        {
          host: 'legifrance.gouv.fr',
          citation_count: 3,
          allowlisted_count: 3,
          translation_warnings: 0,
          last_cited_at: '2024-07-01T10:00:00Z',
        },
      ],
    );

    expect(metrics.summary?.runsTotal).toBe(5);
    expect(metrics.summary?.avgLocalSnippets).toBeCloseTo(2.5, 5);
    expect(metrics.summary?.allowlistedRatio).toBeCloseTo(0.9, 5);
    expect(metrics.origins).toHaveLength(2);
    expect(metrics.origins[0].origin).toBe('local');
    expect(metrics.origins[0].avgSimilarity).toBeCloseTo(0.8, 5);
    expect(metrics.hosts[0].host).toBe('legifrance.gouv.fr');
    expect(metrics.hosts[0].translationWarnings).toBe(0);
  });

  it('maps learning reports with safe payload fallbacks', () => {
    const rows = [
      {
        kind: 'drift',
        report_date: '2024-09-01',
        payload: { totalRuns: 5, hitlEscalations: 2 },
        created_at: '2024-09-01T06:00:00Z',
      },
      {
        kind: 'queue',
        report_date: '2024-09-01',
        payload: null,
        created_at: '2024-09-01T07:00:00Z',
      },
      {
        kind: 'fairness',
        report_date: '2024-09-01',
        payload: { flagged: { jurisdictions: ['FR'], benchmarks: [] } },
        created_at: '2024-09-01T08:00:00Z',
      },
    ];

    const mapped = mapLearningReports(rows as any);
    expect(mapped).toHaveLength(3);
    expect(mapped[0]).toEqual({
      kind: 'drift',
      reportDate: '2024-09-01',
      createdAt: '2024-09-01T06:00:00Z',
      payload: { totalRuns: 5, hitlEscalations: 2 },
    });
    expect(mapped[1].kind).toBe('queue');
    expect(mapped[1].payload).toEqual({});
    expect(mapped[2].payload).toEqual({ flagged: { jurisdictions: ['FR'], benchmarks: [] } });
  });
});
