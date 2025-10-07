import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetLaunchStateForTests } from '../src/launch.js';
import { __resetWebVitalsForTests } from '../src/metrics.js';
import { __resetPostLaunchStateForTests, enqueueOfflineOutboxItem } from '../src/post-launch.js';

process.env.NODE_ENV = 'test';

const storageFromMock = vi.fn();

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: storageFromMock },
};

const authorizeActionMock = vi.fn();
const ensureOrgAccessComplianceMock = vi.fn();
const runLegalAgentMock = vi.fn();
const getHybridRetrievalContextMock = vi.fn();

const summariseDocumentFromPayloadMock = vi.fn();

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

vi.mock('../src/access-control.js', () => ({
  authorizeAction: authorizeActionMock,
  ensureOrgAccessCompliance: ensureOrgAccessComplianceMock,
}));

vi.mock('../src/agent.js', () => ({
  runLegalAgent: runLegalAgentMock,
  getHybridRetrievalContext: getHybridRetrievalContextMock,
}));

vi.mock('../src/audit.js', () => ({
  logAuditEvent: vi.fn(async () => undefined),
}));

vi.mock('../src/summarization.js', () => ({
  summariseDocumentFromPayload: summariseDocumentFromPayloadMock,
}));

const { app } = await import('../src/server.ts');

function makeAccessContext(overrides: Record<string, unknown> = {}) {
  const base = {
    orgId: 'org-1',
    userId: 'user-1',
    role: 'member',
    policies: {
      confidentialMode: false,
      franceJudgeAnalyticsBlocked: true,
      mfaRequired: false,
      ipAllowlistEnforced: false,
      consentVersion: null,
      councilOfEuropeDisclosureVersion: null,
      sensitiveTopicHitl: true,
      residencyZone: null,
    },
    rawPolicies: {},
    entitlements: new Map<string, { canRead: boolean; canWrite: boolean }>([['FR', { canRead: true, canWrite: true }]]),
    ipAllowlistCidrs: [],
    consent: { requiredVersion: null, latestAcceptedVersion: null },
    abac: {
      jurisdictionEntitlements: new Map<string, { canRead: boolean; canWrite: boolean }>([['FR', { canRead: true, canWrite: true }]]),
      confidentialMode: false,
      sensitiveTopicHitl: true,
      residencyZone: null,
    },
  } as Record<string, unknown>;
  return {
    ...base,
    ...overrides,
    entitlements: overrides.entitlements ?? base.entitlements,
    abac: {
      ...(base.abac as Record<string, unknown>),
      ...((overrides.abac ?? {}) as Record<string, unknown>),
    },
  };
}

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    __result: result,
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(result),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

describe('API routes', () => {
  beforeEach(() => {
    __resetLaunchStateForTests();
    __resetWebVitalsForTests();
    __resetPostLaunchStateForTests();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    storageFromMock.mockReset();
    summariseDocumentFromPayloadMock.mockReset();
    authorizeActionMock.mockReset();
    ensureOrgAccessComplianceMock.mockReset();
    runLegalAgentMock.mockReset();
    getHybridRetrievalContextMock.mockReset();

    authorizeActionMock.mockResolvedValue(makeAccessContext());
    ensureOrgAccessComplianceMock.mockImplementation(() => undefined);
    runLegalAgentMock.mockResolvedValue({
      runId: 'run-123',
      payload: {
        issue: '',
        rules: [],
        application: '',
        conclusion: '',
        citations: [],
        risk: { level: 'LOW', why: '', hitl_required: false },
      },
      toolLogs: [],
      plan: [],
      notices: [],
      reused: false,
      verification: null,
      trustPanel: null,
      allowlistViolations: [],
      agent: { key: 'concierge', code: 'concierge', label: 'Concierge', settings: {}, tools: [] },
    });
    getHybridRetrievalContextMock.mockResolvedValue({ snippetCount: 0, topHosts: [] });
  });

  it('returns workspace overview with the phase C multi-agent desk', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'jurisdictions') {
        const builder = createQueryBuilder({
          data: [{ code: 'FR', name: 'France', eu: true, ohada: false }],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        return builder;
      }
      if (table === 'agent_runs') {
        const builder = createQueryBuilder({
          data: [
            {
              id: 'run-1',
              question: 'Civil claim deadline?',
              risk_level: 'LOW',
              hitl_required: false,
              status: 'research',
              started_at: '2024-06-01T10:00:00Z',
              finished_at: '2024-06-01T10:01:00Z',
              jurisdiction_json: { country: 'FR' },
              agent_code: 'bench_memo',
            },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      if (table === 'sources') {
        const builder = createQueryBuilder({ data: [], error: null });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      if (table === 'hitl_queue') {
        const builder = createQueryBuilder({ data: [], error: null });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/workspace?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      desk: {
        playbooks: Array<{ id: string }>;
        quickActions: Array<{ id: string }>;
        personas: Array<{ agentCode: string }>;
        toolChips: Array<{ id: string }>;
      };
      jurisdictions: Array<{ code: string }>;
    };

    expect(body.jurisdictions).toHaveLength(1);
    expect(body.jurisdictions[0].code).toBe('FR');
    expect(body.desk.playbooks.some((playbook) => playbook.id === 'fr-civil-claim')).toBe(true);
    expect(body.desk.quickActions.map((item) => item.id)).toEqual(
      expect.arrayContaining(['open-plan', 'trust-dashboard']),
    );
    expect(body.desk.personas.some((persona) => persona.agentCode === 'bench_memo')).toBe(true);
    expect(body.desk.toolChips.some((chip) => chip.id === 'mode-trust')).toBe(true);
    expect(authorizeActionMock).toHaveBeenCalledWith('workspace:view', 'org-1', 'user-1');
  });

  it('records and lists core web vitals metrics', async () => {
    const postResponse = await app.inject({
      method: 'POST',
      url: '/metrics/web-vitals',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
      payload: {
        id: 'metric-1',
        name: 'LCP',
        value: 1800,
        delta: 12,
        label: 'web-vital',
        rating: 'good',
        page: '/research',
        locale: 'fr',
        navigationType: 'navigate',
      },
    });

    expect(postResponse.statusCode).toBe(204);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/metrics/web-vitals',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
    });

    expect(listResponse.statusCode).toBe(200);
    const body = listResponse.json() as { metrics: Array<{ name: string; rating: string; page: string }> };
    expect(body.metrics).toHaveLength(1);
    expect(body.metrics[0]).toMatchObject({ name: 'LCP', rating: 'good', page: '/research' });
  });

  it('requires authentication headers for web vitals ingestion', async () => {
    const response = await app.inject({ method: 'POST', url: '/metrics/web-vitals', payload: {} });
    expect(response.statusCode).toBe(400);
  });

  it('returns compliance acknowledgements for the current user', async () => {
    authorizeActionMock.mockResolvedValue(
      makeAccessContext({
        policies: {
          confidentialMode: false,
          franceJudgeAnalyticsBlocked: true,
          mfaRequired: false,
          ipAllowlistEnforced: false,
          consentVersion: '2024.09',
          councilOfEuropeDisclosureVersion: '2024.05',
          sensitiveTopicHitl: true,
          residencyZone: null,
        },
        consent: { requiredVersion: '2024.09', latestAcceptedVersion: '2024.08' },
      }),
    );

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'consent_events') {
        const builder = createQueryBuilder({
          data: [
            { type: 'ai_assist_terms', version: '2024.09', created_at: '2024-09-10T00:00:00Z' },
            { type: 'council_of_europe_disclosure', version: '2024.05', created_at: '2024-09-11T00:00:00Z' },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.or.mockReturnValue(builder);
        builder.in.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        return builder;
      }
      return createQueryBuilder({ data: [], error: null });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/compliance/acknowledgements',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.orgId).toBe('org-1');
    expect(body.acknowledgements.consent.requiredVersion).toBe('2024.09');
    expect(body.acknowledgements.councilOfEurope.acknowledgedVersion).toBe('2024.05');
  });

  it('returns compliance status summary with acknowledgement data', async () => {
    authorizeActionMock.mockResolvedValue(
      makeAccessContext({
        policies: {
          confidentialMode: false,
          franceJudgeAnalyticsBlocked: true,
          mfaRequired: false,
          ipAllowlistEnforced: false,
          consentVersion: '2024.09',
          councilOfEuropeDisclosureVersion: '2024.05',
          sensitiveTopicHitl: true,
          residencyZone: null,
        },
        consent: { requiredVersion: '2024.09', latestAcceptedVersion: '2024.08' },
      }),
    );

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'compliance_assessments') {
        const builder = createQueryBuilder({
          data: [
            {
              run_id: 'run-123',
              created_at: '2024-09-15T10:00:00Z',
              fria_required: true,
              fria_reasons: ['High-risk dossier'],
              cepej_passed: false,
              cepej_violations: ['transparency'],
              statute_passed: true,
              statute_violations: [],
              disclosures_missing: ['consent'],
            },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      if (table === 'consent_events') {
        const builder = createQueryBuilder({
          data: [
            { type: 'ai_assist_terms', version: '2024.09', created_at: '2024-09-10T00:00:00Z' },
            { type: 'council_of_europe_disclosure', version: '2024.05', created_at: '2024-09-11T00:00:00Z' },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.or.mockReturnValue(builder);
        builder.in.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        return builder;
      }
      return createQueryBuilder({ data: [], error: null });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/compliance/status',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.latest.runId).toBe('run-123');
    expect(body.latest.assessment.disclosures.requiredConsentVersion).toBe('2024.09');
    expect(body.acknowledgements.councilOfEurope.acknowledgedVersion).toBe('2024.05');
  });

  it('returns learning reports including fairness metrics', async () => {
    const now = new Date().toISOString();
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'agent_learning_reports') {
        return createQueryBuilder({
          data: [
            { kind: 'drift', report_date: '2024-09-01', payload: { totalRuns: 3 }, created_at: now },
            {
              kind: 'fairness',
              report_date: '2024-09-01',
              payload: { flagged: { jurisdictions: ['FR'], benchmarks: [] } },
              created_at: now,
            },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/reports/learning?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { reports: Array<{ kind: string; payload: Record<string, unknown> }> };
    expect(body.reports).toHaveLength(2);
    const fairness = body.reports.find((entry) => entry.kind === 'fairness');
    expect(fairness?.payload?.flagged).toBeTruthy();
  });

  it('returns evaluation metrics summary and jurisdictions', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'org_evaluation_metrics') {
        const builder = createQueryBuilder({
          data: {
            org_id: 'org-1',
            total_cases: 12,
            evaluated_results: 9,
            pass_rate: 0.75,
            citation_precision_p95: 0.98,
            temporal_validity_p95: 1,
            citation_precision_coverage: 0.9,
            temporal_validity_coverage: 1,
            maghreb_banner_coverage: 1,
            rwanda_notice_coverage: 0.5,
            last_result_at: '2024-09-02T00:00:00Z',
          },
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      if (table === 'org_evaluation_jurisdiction_metrics') {
        const builder = createQueryBuilder({
          data: [
            {
              jurisdiction: 'FR',
              evaluation_count: 5,
              pass_rate: 0.8,
              citation_precision_median: 0.96,
              temporal_validity_median: 1,
              avg_binding_warnings: 0,
              maghreb_banner_coverage: null,
              rwanda_notice_coverage: null,
            },
            {
              jurisdiction: 'MA',
              evaluation_count: 2,
              pass_rate: 0.5,
              citation_precision_median: 0.92,
              temporal_validity_median: 0.9,
              avg_binding_warnings: 1,
              maghreb_banner_coverage: 1,
              rwanda_notice_coverage: null,
            },
            {
              jurisdiction: 'RW',
              evaluation_count: 1,
              pass_rate: 1,
              citation_precision_median: 1,
              temporal_validity_median: 1,
              avg_binding_warnings: 0,
              maghreb_banner_coverage: null,
              rwanda_notice_coverage: 1,
            },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/evaluations?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      summary: {
        totalCases: number;
        evaluatedResults: number;
        passRate: number | null;
        rwandaNoticeCoverage?: number | null;
      } | null;
      jurisdictions: Array<{ jurisdiction: string; rwandaNoticeCoverage?: number | null }>;
    };
    expect(body.summary).toMatchObject({ totalCases: 12, evaluatedResults: 9, passRate: 0.75 });
    expect(body.summary?.rwandaNoticeCoverage).toBeCloseTo(0.5);
    expect(body.jurisdictions).toHaveLength(3);
    const rwandaRow = body.jurisdictions.find((row) => row.jurisdiction === 'RW');
    expect(rwandaRow?.rwandaNoticeCoverage).toBe(1);
  });

  it('returns retrieval metrics with jurisdiction rollups and fairness trend', async () => {
    const now = '2024-09-05T10:00:00Z';

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'org_retrieval_metrics') {
        const builder = createQueryBuilder({
          data: {
            runs_total: 12,
            avg_local_snippets: 4,
            avg_file_snippets: 2,
            allowlisted_ratio: 0.75,
            runs_with_translation_warnings: 2,
            runs_without_citations: 1,
            last_run_at: now,
          },
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        builder.maybeSingle.mockResolvedValue(builder.__result);
        return builder;
      }
      if (table === 'org_retrieval_origin_metrics') {
        const builder = createQueryBuilder({
          data: [
            { origin: 'local', snippet_count: 6, avg_similarity: 0.92, avg_weight: 0.6 },
            { origin: 'file_search', snippet_count: 3, avg_similarity: 0.75, avg_weight: 0.4 },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        return builder;
      }
      if (table === 'org_retrieval_host_metrics') {
        const builder = createQueryBuilder({
          data: [
            {
              host: 'legifrance.gouv.fr',
              citation_count: 4,
              allowlisted_count: 4,
              translation_warnings: 1,
              last_cited_at: now,
            },
            {
              host: 'example.org',
              citation_count: 2,
              allowlisted_count: 0,
              translation_warnings: 0,
              last_cited_at: now,
            },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      if (table === 'agent_learning_reports') {
        const builder = createQueryBuilder({
          data: {
            payload: {
              capturedAt: now,
              overall: { hitlRate: 0.25, highRiskShare: 0.2 },
              jurisdictions: [
                {
                  code: 'FR',
                  totalRuns: 4,
                  hitlRate: 0.5,
                  highRiskShare: 0.3,
                  benchmarkRate: 0.9,
                  synonyms: { terms: 2, expansions: 5 },
                },
                {
                  code: 'MA',
                  totalRuns: 2,
                  hitlRate: 0.1,
                  highRiskShare: 0.05,
                  benchmarkRate: 0.6,
                  synonyms: { terms: 0, expansions: 0 },
                },
              ],
              flagged: {
                jurisdictions: ['FR'],
                benchmarks: ['lexglue:fr'],
                synonyms: ['MA'],
              },
            },
            report_date: now,
          },
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        builder.maybeSingle.mockResolvedValue(builder.__result);
        return builder;
      }
      if (table === 'agent_runs') {
        const builder = createQueryBuilder({
          data: [
            {
              id: 'run-1',
              jurisdiction_json: { country: 'FR' },
              risk_level: 'HIGH',
              hitl_required: true,
            },
            {
              id: 'run-2',
              jurisdiction_json: { country: 'MA' },
              risk_level: 'LOW',
              hitl_required: false,
            },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      if (table === 'run_citations') {
        const builder = createQueryBuilder({
          data: [
            { run_id: 'run-1', url: 'https://www.legifrance.gouv.fr', note: 'Traduction officielle' },
            { run_id: 'run-2', url: 'https://example.org', note: null },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.in.mockReturnValue(builder);
        return builder;
      }
      if (table === 'run_retrieval_sets') {
        const builder = createQueryBuilder({
          data: [
            { run_id: 'run-1', weight: 0.8, origin: 'local' },
            { run_id: 'run-2', weight: 0.4, origin: 'file_search' },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.in.mockReturnValue(builder);
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/retrieval?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      summary: { runsTotal: number; allowlistedRatio: number | null; lastRunAt: string | null } | null;
      origins: Array<{ origin: string; snippetCount: number }>;
      hosts: Array<{ host: string; citationCount: number }>;
      jurisdictions: Array<{ jurisdiction: string; runCount: number; allowlistedRatio: number | null }>;
      fairness: {
        capturedAt: string | null;
        flagged: { jurisdictions: string[]; benchmarks: string[]; synonyms: string[] };
        jurisdictions: Array<{ jurisdiction: string; synonyms?: { terms: number; expansions: number } | null }>;
      } | null;
    };

    expect(body.summary).toMatchObject({ runsTotal: 12, allowlistedRatio: 0.75, lastRunAt: now });
    expect(body.origins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ origin: 'local', snippetCount: 6 }),
        expect.objectContaining({ origin: 'file_search', snippetCount: 3 }),
      ]),
    );
    expect(body.hosts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ host: 'legifrance.gouv.fr', citationCount: 4 }),
        expect.objectContaining({ host: 'example.org', citationCount: 2 }),
      ]),
    );
    expect(body.jurisdictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jurisdiction: 'FR', runCount: 1, allowlistedRatio: 1 }),
        expect.objectContaining({ jurisdiction: 'MA', runCount: 1, allowlistedRatio: 0 }),
      ]),
    );
    expect(body.fairness?.capturedAt).toBe(now);
    expect(body.fairness?.flagged.jurisdictions).toContain('FR');
    expect(body.fairness?.flagged.synonyms).toContain('MA');
    const frFairness = body.fairness?.jurisdictions.find((entry) => entry.jurisdiction === 'FR');
    expect(frFairness?.synonyms).toMatchObject({ terms: 2, expansions: 5 });
  });

  it('returns 500 when evaluation metrics query fails', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'org_evaluation_metrics') {
        const builder = createQueryBuilder({ data: null, error: { message: 'boom' } });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      if (table === 'org_evaluation_jurisdiction_metrics') {
        const builder = createQueryBuilder({ data: [], error: null });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/evaluations?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(500);
    const body = response.json() as { error: string };
    expect(body.error).toBe('metrics_evaluation_summary_failed');
  });

  it('returns 403 when agent execution is forbidden', async () => {
    authorizeActionMock.mockRejectedValue(Object.assign(new Error('permission_denied'), { statusCode: 403 }));

    const response = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: {
        question: 'Analyse cette clause.',
        orgId: 'org-1',
        userId: 'user-1',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(runLegalAgentMock).not.toHaveBeenCalled();
  });

  it('enforces confidential mode from policy when executing runs', async () => {
    authorizeActionMock.mockResolvedValue(
      makeAccessContext({
        policies: {
          ...makeAccessContext().policies,
          confidentialMode: true,
        },
        abac: {
          ...makeAccessContext().abac,
          confidentialMode: true,
        },
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: {
        question: 'Analyse confidentielle.',
        orgId: 'org-1',
        userId: 'user-1',
        confidentialMode: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(runLegalAgentMock).toHaveBeenCalledTimes(1);
    const [inputArg, contextArg] = runLegalAgentMock.mock.calls[0];
    expect(inputArg.confidentialMode).toBe(true);
    expect(contextArg.policies?.confidentialMode).toBe(true);
    expect(ensureOrgAccessComplianceMock).toHaveBeenCalled();
  });

  it('lists ingestion quarantine entries for an org', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'ingestion_quarantine') {
        const builder = createQueryBuilder({
          data: [
            {
              id: 'quar-1',
              org_id: 'org-1',
              adapter_id: 'gdrive',
              source_url: 'https://example.com/case.pdf',
              canonical_url: null,
              reason: 'non_allowlisted',
              metadata: { status: 'pending' },
              created_at: '2024-10-04T12:00:00Z',
            },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/ingestion/quarantine?orgId=org-1&adapterId=gdrive',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { entries: Array<Record<string, unknown>> };
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toMatchObject({ id: 'quar-1', adapterId: 'gdrive', reason: 'non_allowlisted' });
    expect(authorizeActionMock).toHaveBeenCalledWith('corpus:manage', 'org-1', 'user-1');
  });

  it('returns 403 when listing quarantine without permission', async () => {
    authorizeActionMock.mockRejectedValue(Object.assign(new Error('permission_denied'), { statusCode: 403 }));

    const response = await app.inject({
      method: 'GET',
      url: '/ingestion/quarantine?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(403);
    expect(supabaseMock.from).not.toHaveBeenCalledWith('ingestion_quarantine');
  });

  it('returns 500 when quarantine query fails', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'ingestion_quarantine') {
        const builder = createQueryBuilder({ data: null, error: { message: 'boom' } });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/ingestion/quarantine?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(500);
    const body = response.json() as { error: string };
    expect(body.error).toBe('quarantine_fetch_failed');
  });

  it('deletes a quarantine entry for an org', async () => {
    const deleteBuilder: any = {
      eq: vi.fn(() => deleteBuilder),
      select: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'quar-1' }, error: null })),
      })),
    };

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'ingestion_quarantine') {
        return {
          delete: vi.fn(() => deleteBuilder),
        } as unknown as typeof supabaseMock.from;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/ingestion/quarantine/quar-1?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deleted: 'quar-1' });
    expect(authorizeActionMock).toHaveBeenCalledWith('corpus:manage', 'org-1', 'user-1');
  });

  it('returns 404 when deleting a missing quarantine entry', async () => {
    const deleteBuilder: any = {
      eq: vi.fn(() => deleteBuilder),
      select: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    };

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'ingestion_quarantine') {
        return {
          delete: vi.fn(() => deleteBuilder),
        } as unknown as typeof supabaseMock.from;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/ingestion/quarantine/quar-404?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'quarantine_entry_not_found' });
  });

  it('returns 500 when quarantine delete fails', async () => {
    const deleteBuilder: any = {
      eq: vi.fn(() => deleteBuilder),
      select: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } })),
      })),
    };

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'ingestion_quarantine') {
        return {
          delete: vi.fn(() => deleteBuilder),
        } as unknown as typeof supabaseMock.from;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/ingestion/quarantine/quar-1?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'quarantine_delete_failed' });
  });

  it('summarises quarantine entries by adapter and reason', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'ingestion_quarantine') {
        const builder = createQueryBuilder({
          data: [
            { adapter_id: 'gdrive', reason: 'non_allowlisted' },
            { adapter_id: 'gdrive', reason: 'non_allowlisted' },
            { adapter_id: 'gdrive', reason: 'missing_metadata' },
            { adapter_id: 'manual', reason: 'translation_without_binding' },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/ingestion/quarantine/summary?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      adapters: Array<{ adapterId: string; reasons: Array<{ reason: string; count: number }> }>;
    };
    const gdrive = body.adapters.find((entry) => entry.adapterId === 'gdrive');
    expect(gdrive).toBeDefined();
    const allowlisted = gdrive?.reasons.find((r) => r.reason === 'non_allowlisted');
    expect(allowlisted?.count).toBe(2);
    expect(authorizeActionMock).toHaveBeenCalledWith('corpus:manage', 'org-1', 'user-1');
  });

  it('returns 403 when summarising quarantine without permission', async () => {
    authorizeActionMock.mockRejectedValue(Object.assign(new Error('permission_denied'), { statusCode: 403 }));

    const response = await app.inject({
      method: 'GET',
      url: '/ingestion/quarantine/summary?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(403);
    expect(supabaseMock.from).not.toHaveBeenCalledWith('ingestion_quarantine');
  });

  it('returns 500 when quarantine summary query fails', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'ingestion_quarantine') {
        const builder = createQueryBuilder({ data: null, error: { message: 'boom' } });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/ingestion/quarantine/summary?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'quarantine_summary_failed' });
  });

  it('lists ingestion runs for an org', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'ingestion_runs') {
        const builder = createQueryBuilder({
          data: [
            {
              id: 'run-1',
              adapter_id: 'drive-watcher',
              status: 'completed',
              inserted_count: 3,
              failed_count: 0,
              skipped_count: 0,
              finished_at: '2024-10-01T12:00:00Z',
              error_message: null,
            },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/ingestion/runs?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { runs: Array<{ id: string }> };
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].id).toBe('run-1');
    expect(authorizeActionMock).toHaveBeenCalledWith('corpus:manage', 'org-1', 'user-1');
  });

  it('returns 500 when ingestion runs query fails', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'ingestion_runs') {
        const builder = createQueryBuilder({ data: null, error: { message: 'boom' } });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/ingestion/runs?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'ingestion_runs_failed' });
  });

  it('lists governance publications with filters', async () => {
    const now = new Date().toISOString();
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'governance_publications') {
        return createQueryBuilder({
          data: [
            {
              slug: 'dpia',
              title: 'DPIA 2024',
              summary: 'Synthèse des engagements',
              doc_url: 'https://example.com/dpia.pdf',
              category: 'dpiA',
              status: 'published',
              published_at: now,
              metadata: null,
            },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/governance/publications?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { publications: Array<{ slug: string }> };
    expect(body.publications[0].slug).toBe('dpia');
  });

  it('returns governance metrics with identifier coverage', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'org_metrics') {
        return createQueryBuilder({
          data: {
            org_id: 'org-1',
            name: 'Demo Org',
            total_runs: 10,
            runs_last_30_days: 4,
            high_risk_runs: 2,
            confidential_runs: 1,
            avg_latency_ms: 1200,
            allowlisted_citation_ratio: 0.95,
            hitl_pending: 1,
            hitl_median_response_minutes: 12,
            ingestion_success_last_7_days: 5,
            ingestion_failed_last_7_days: 1,
            evaluation_cases: 8,
            evaluation_pass_rate: 0.88,
            documents_total: 20,
            documents_ready: 18,
            documents_pending: 1,
            documents_failed: 0,
            documents_skipped: 1,
            documents_chunked: 18,
          },
          error: null,
        });
      }
      if (table === 'tool_performance_metrics') {
        return createQueryBuilder({ data: [], error: null });
      }
      if (table === 'org_provenance_metrics') {
        return createQueryBuilder({
          data: {
            org_id: 'org-1',
            total_sources: 4,
            sources_with_binding: 4,
            sources_with_language_note: 2,
            sources_with_eli: 2,
            sources_with_ecli: 1,
            sources_with_residency: 4,
            sources_link_ok_recent: 4,
            sources_link_stale: 0,
            sources_link_failed: 0,
            binding_breakdown: { fr: 4 },
            residency_breakdown: { eu: 2, ohada: 2 },
            chunk_total: 40,
            chunks_with_markers: 32,
          },
          error: null,
        });
      }
      if (table === 'jurisdiction_identifier_coverage') {
        return createQueryBuilder({
          data: [
            {
              org_id: 'org-1',
              jurisdiction_code: 'FR',
              sources_total: 2,
              sources_with_eli: 2,
              sources_with_ecli: 1,
              sources_with_akoma: 2,
              akoma_article_count: 120,
            },
          ],
          error: null,
        });
      }
      if (table === 'org_jurisdiction_provenance') {
        return createQueryBuilder({
          data: [
            {
              org_id: 'org-1',
              jurisdiction_code: 'FR',
              residency_zone: 'eu',
              total_sources: 2,
              sources_consolidated: 1,
              sources_with_binding: 2,
              sources_with_language_note: 1,
              sources_with_eli: 2,
              sources_with_ecli: 1,
              sources_with_akoma: 2,
              binding_breakdown: { fr: 2 },
              source_type_breakdown: { statute: 2 },
              language_note_breakdown: { traduction: 1 },
            },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/governance?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { identifiers: Array<{ jurisdiction: string; sourcesTotal: number }> };
    expect(body.identifiers).toHaveLength(1);
    expect(body.identifiers[0]).toMatchObject({ jurisdiction: 'FR', sourcesTotal: 2, sourcesWithEli: 2 });
  });

  it('returns operations overview with SLO, incidents, change log, and go-no-go', async () => {
    const now = new Date().toISOString();
    const previous = new Date(Date.now() - 86_400_000).toISOString();

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'slo_snapshots') {
        return createQueryBuilder({
          data: [
            {
              captured_at: now,
              api_uptime_percent: 0.995,
              hitl_response_p95_seconds: 32.4,
              retrieval_latency_p95_seconds: 21.8,
              citation_precision_p95: 0.97,
              notes: 'Stabilité nominale',
            },
            {
              captured_at: previous,
              api_uptime_percent: 0.99,
              hitl_response_p95_seconds: 45.2,
              retrieval_latency_p95_seconds: 30.1,
              citation_precision_p95: 0.95,
              notes: null,
            },
          ],
          error: null,
        });
      }
      if (table === 'incident_reports') {
        return createQueryBuilder({
          data: [
            {
              id: 'incident-1',
              occurred_at: previous,
              detected_at: previous,
              resolved_at: now,
              severity: 'medium',
              status: 'closed',
              title: 'Latence HITL',
              summary: 'Temps de réponse au-dessus du SLA.',
              impact: 'Retard de 12 minutes.',
              resolution: 'Réaffectation reviewer',
              follow_up: 'Ajouter un alerting p95',
              evidence_url: 'https://example.com/incident',
              recorded_at: now,
            },
          ],
          error: null,
        });
      }
      if (table === 'change_log_entries') {
        return createQueryBuilder({
          data: [
            {
              id: 'change-1',
              entry_date: '2024-09-15',
              title: 'Mise à jour SLO',
              category: 'ops',
              summary: 'Nouvelles métriques publiées.',
              release_tag: '2024.09',
              links: { docs: ['https://example.com/change'] },
              recorded_at: now,
            },
          ],
          error: null,
        });
      }
      if (table === 'go_no_go_evidence') {
        return createQueryBuilder({
          data: [
            {
              section: 'A',
              criterion: 'SLO >= 99%',
              status: 'satisfied',
              evidence_url: 'https://example.com/slo',
              notes: { proof: 'dashboard' },
              recorded_at: now,
            },
          ],
          error: null,
        });
      }
      if (table === 'cepej_metrics') {
        const builder = createQueryBuilder({
          data: {
            assessed_runs: 4,
            passed_runs: 3,
            violation_runs: 1,
            fria_required_runs: 1,
            pass_rate: 0.75,
          },
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      if (table === 'cepej_violation_breakdown') {
        const builder = createQueryBuilder({
          data: [
            { violation: 'transparency', occurrences: 1 },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        return builder;
      }
      if (table === 'org_evaluation_metrics') {
        const builder = createQueryBuilder({
          data: {
            maghreb_banner_coverage: 0.9,
            rwanda_notice_coverage: 0.6,
          },
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      if (table === 'ui_telemetry_events') {
        const builder = createQueryBuilder({
          data: [
            { payload: { metric: 'LCP', value: 3200 }, created_at: now },
            { payload: { metric: 'CLS', value: 0.12 }, created_at: now },
          ],
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.gte = vi.fn(() => builder);
        builder.order.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      if (table === 'org_provenance_metrics') {
        const builder = createQueryBuilder({
          data: {
            total_sources: 10,
            sources_with_binding: 9,
            sources_with_residency: 8,
          },
          error: null,
        });
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.limit.mockReturnValue(builder);
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/org/org-1/operations/overview',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      slo: { summary: { latestCapture: string | null; apiUptimeP95: number | null } | null };
      incidents: { total: number; entries: Array<{ id: string }> };
      changeLog: { entries: Array<{ id: string }> };
      goNoGo: { criteria: Array<{ criterion: string; recordedStatus: string }> };
      compliance: {
        cepej: { assessedRuns: number; violationRuns: number };
        evaluationCoverage: { maghrebBanner: number | null; rwandaNotice: number | null };
        bindingCoverage: number | null;
        residencyCoverage: number | null;
        alerts: Array<{ code: string }>;
      };
      webVitals: {
        metrics: { LCP: { p75: number | null }; CLS: { p75: number | null } };
        alerts: Array<{ code: string }>;
      };
    };

    expect(body.slo.summary).toMatchObject({ latestCapture: now, apiUptimeP95: expect.any(Number) });
    expect(body.incidents.total).toBe(1);
    expect(body.incidents.entries[0]?.id).toBe('incident-1');
    expect(body.changeLog.entries[0]?.id).toBe('change-1');
    expect(body.compliance.bindingCoverage).toBeCloseTo(0.9);
    expect(body.compliance.residencyCoverage).toBeCloseTo(0.8);
    expect(body.goNoGo.criteria[0]).toMatchObject({ criterion: 'SLO >= 99%', recordedStatus: 'satisfied' });
    expect(body.compliance.cepej.assessedRuns).toBe(4);
    expect(body.compliance.evaluationCoverage.rwandaNotice).toBeCloseTo(0.6);
    expect(body.compliance.alerts.map((alert) => alert.code)).toEqual(
      expect.arrayContaining(['cepej_violation', 'rwanda_notice_low']),
    );
    expect(body.webVitals.metrics.LCP.p75).toBe(3200);
    expect(body.webVitals.alerts.map((alert) => alert.code)).toContain('web_vitals_lcp');
  });

  it('returns HITL metrics from learning reports', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'agent_learning_reports') {
        return createQueryBuilder({
          data: [
            {
              kind: 'queue',
              report_date: '2024-09-03',
              payload: {
                pending: 3,
                byType: { indexing_ticket: 2 },
                capturedAt: '2024-09-03T10:00:00Z',
              },
            },
            {
              kind: 'drift',
              report_date: '2024-09-03',
              payload: {
                totalRuns: 10,
                highRiskRuns: 2,
                hitlEscalations: 3,
                allowlistedRatio: 0.9,
              },
            },
            {
              kind: 'fairness',
              report_date: '2024-09-03',
              payload: {
                capturedAt: '2024-09-03T10:00:00Z',
                overall: { totalRuns: 10, hitlRate: 0.3 },
                flagged: { jurisdictions: ['FR'], benchmarks: [] },
              },
            },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/hitl/metrics?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      metrics: {
        queue: { pending: number; byType: Record<string, number> } | null;
        drift: { totalRuns: number; hitlEscalations: number; allowlistedRatio: number | null } | null;
        fairness: { flagged: { jurisdictions: string[] } } | null;
      };
    };
    expect(body.metrics.queue?.pending).toBe(3);
    expect(body.metrics.queue?.byType?.indexing_ticket).toBe(2);
    expect(body.metrics.drift?.hitlEscalations).toBe(3);
    expect(body.metrics.drift?.allowlistedRatio).toBeCloseTo(0.9);
    expect(body.metrics.fairness?.flagged.jurisdictions).toContain('FR');
  });

  it('persists reviewer edits when a HITL action is submitted', async () => {
    const insertedEdits: Array<Record<string, unknown>> = [];
    let hitlInvocations = 0;
    let runInvocations = 0;

    supabaseMock.from.mockImplementation((table: string) => {
      switch (table) {
        case 'hitl_queue': {
          hitlInvocations += 1;
          if (hitlInvocations === 1) {
            return createQueryBuilder({
              data: {
                id: 'hitl-1',
                run_id: 'run-42',
                org_id: 'org-1',
                created_at: '2024-09-01T00:00:00Z',
                status: 'pending',
              },
              error: null,
            });
          }
          if (hitlInvocations === 2) {
            return createQueryBuilder({
              data: { run_id: 'run-42', org_id: 'org-1' },
              error: null,
            });
          }
          throw new Error('unexpected hitl_queue call');
        }
        case 'agent_runs': {
          runInvocations += 1;
          if (runInvocations === 1) {
            return createQueryBuilder({
              data: {
                id: 'run-42',
                org_id: 'org-1',
                irac: {
                  jurisdiction: { country: 'FR', eu: true, ohada: false },
                  issue: 'Analyse',
                  rules: [],
                  application: '',
                  conclusion: '',
                  citations: [],
                  risk: { level: 'HIGH', why: 'review required', hitl_required: true },
                },
              },
              error: null,
            });
          }
          return createQueryBuilder({ data: null, error: null });
        }
        case 'hitl_reviewer_edits':
          return {
            insert: (payload: Record<string, unknown>) => {
              insertedEdits.push(payload);
              return Promise.resolve({ data: null, error: null });
            },
          } as any;
        case 'agent_learning_jobs':
          return {
            insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
          } as any;
        default:
          throw new Error(`unexpected table ${table}`);
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/hitl/hitl-1',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
      payload: {
        action: 'request_changes',
        comment: 'Needs additional context',
        reviewerId: 'reviewer-9',
        revisedPayload: {
          jurisdiction: { country: 'FR', eu: true, ohada: false },
          issue: 'Analyse',
          rules: [],
          application: 'Compléter',
          conclusion: 'À revoir',
          citations: [],
          risk: { level: 'HIGH', why: 'review required', hitl_required: true },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(insertedEdits).toHaveLength(1);
    const edit = insertedEdits[0];
    expect(edit).toMatchObject({
      hitl_id: 'hitl-1',
      run_id: 'run-42',
      org_id: 'org-1',
      action: 'changes_requested',
      comment: 'Needs additional context',
    });
    expect(edit?.previous_payload).toBeTruthy();
    expect(edit?.revised_payload).toMatchObject({ conclusion: 'À revoir' });
  });

  it('returns HITL detail with run context', async () => {
    let hitlCalls = 0;
    supabaseMock.from.mockImplementation((table: string) => {
      switch (table) {
        case 'hitl_queue': {
          hitlCalls += 1;
          if (hitlCalls === 1) {
            return createQueryBuilder({
              data: {
                id: 'hitl-1',
                run_id: 'run-42',
                reason: 'high_risk',
                status: 'pending',
                created_at: '2024-09-01T00:00:00Z',
                updated_at: null,
                resolution_minutes: null,
                resolution_bucket: null,
                reviewer_comment: null,
              },
              error: null,
            });
          }
          throw new Error('unexpected hitl_queue call');
        }
        case 'agent_runs':
          return createQueryBuilder({
            data: {
              id: 'run-42',
              org_id: 'org-1',
              question: 'Analyse',
              jurisdiction_json: { country: 'FR' },
              irac: { conclusion: 'OK' },
              risk_level: 'MEDIUM',
              status: 'pending',
              hitl_required: true,
              started_at: '2024-09-01T00:00:00Z',
              finished_at: '2024-09-01T00:01:00Z',
            },
            error: null,
          });
        case 'run_citations':
          return createQueryBuilder({
            data: [
              {
                title: 'Code civil',
                publisher: 'Légifrance',
                url: 'https://legifrance.gouv.fr',
                domain_ok: true,
                note: null,
              },
            ],
            error: null,
          });
        case 'run_retrieval_sets':
          return createQueryBuilder({
            data: [
              {
                id: 'retrieval-1',
                origin: 'local',
                snippet: 'Article 1240',
                similarity: 0.93,
                weight: 0.6,
                metadata: { jurisdiction: 'FR' },
              },
            ],
            error: null,
          });
        case 'hitl_reviewer_edits':
          return createQueryBuilder({
            data: [
              {
                id: 'edit-1',
                action: 'changes_requested',
                comment: 'Préciser la prescription',
                reviewer_id: 'user-1',
                created_at: '2024-09-01T00:05:00Z',
                previous_payload: { conclusion: 'OK' },
                revised_payload: null,
              },
            ],
            error: null,
          });
        default:
          throw new Error(`unexpected table ${table}`);
      }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/hitl/hitl-1?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      hitl: { id: string };
      run: { jurisdiction: string | null; orgId: string | null } | null;
      edits: Array<{ id: string }>;
    };
    expect(body.hitl.id).toBe('hitl-1');
    expect(body.run?.jurisdiction).toBe('FR');
    expect(body.run?.orgId).toBe('org-1');
    expect(body.edits).toHaveLength(1);
  });

  it('builds Akoma Ntoso payload when resummarizing an authority document', async () => {
    const now = new Date().toISOString();

    const documentRow = {
      id: 'doc-1',
      org_id: 'org-1',
      bucket_id: 'authorities',
      storage_path: 'fr/code_civil.txt',
      mime_type: 'text/plain',
      source_id: 'src-1',
      name: 'Code civil',
    };

    const sourceRow = {
      id: 'src-1',
      title: 'Code civil',
      publisher: 'Légifrance',
      jurisdiction_code: 'FR',
      source_url: 'https://www.legifrance.gouv.fr/eli/loi/2020/05/12/2020-1234/jo/texte',
      adopted_date: '2020-05-12',
      effective_date: '2020-05-13',
      binding_lang: 'fr',
      language_note: null,
      consolidated: null,
      eli: null,
      ecli: null,
      akoma_ntoso: null,
    };

    const downloadMock = vi.fn(async () => ({ data: new Blob(['Article 1 ... Article 2 ...']), error: null }));
    storageFromMock.mockReturnValue({ download: downloadMock });

    summariseDocumentFromPayloadMock.mockResolvedValue({
      status: 'ready',
      summary: 'Résumé',
      highlights: [{ heading: 'Point', detail: 'Détail' }],
      chunks: [
        { seq: 0, content: 'Article 1 - contenu', marker: 'Article 1' },
        { seq: 1, content: 'Autre contenu', marker: null },
      ],
      embeddings: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
      error: null,
    });

    const documentUpdateEq = vi.fn(() => ({ error: null }));
    const documentsTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: documentRow, error: null })),
          })),
        })),
      })),
      update: vi.fn(() => ({ eq: documentUpdateEq })),
    };

    const documentChunksDeleteEq = vi.fn(() => ({ error: null }));
    const documentChunksTable = {
      delete: vi.fn(() => ({ eq: documentChunksDeleteEq })),
      insert: vi.fn(async () => ({ error: null })),
    };

    const summaryRow = {
      summary: 'Synthèse existante',
      outline: { sections: [] },
      created_at: now,
    };
    const documentSummariesTable = {
      upsert: vi.fn(async () => ({ error: null })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: summaryRow, error: null })) })),
      })),
    };

    const sourceUpdateEq = vi.fn(() => ({ error: null }));
    const sourceUpdate = vi.fn(() => ({ eq: sourceUpdateEq }));
    const sourcesTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: sourceRow, error: null })),
        })),
      })),
      update: sourceUpdate,
    };

    supabaseMock.from.mockImplementation((table: string) => {
      switch (table) {
        case 'documents':
          return documentsTable as never;
        case 'document_chunks':
          return documentChunksTable as never;
        case 'document_summaries':
          return documentSummariesTable as never;
        case 'sources':
          return sourcesTable as never;
        default:
          return createQueryBuilder({ data: [], error: null }) as never;
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/corpus/doc-1/resummarize',
      payload: { orgId: 'org-1' },
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(summariseDocumentFromPayloadMock).toHaveBeenCalledOnce();
    expect(sourceUpdate).toHaveBeenCalled();
    const updates = sourceUpdate.mock.calls[0]?.[0] as Record<string, any>;
    expect(updates).toBeDefined();
    const akoma = updates.akoma_ntoso as { meta?: { publication?: { consolidated?: boolean | null } }; body?: { articles?: Array<{ marker: string; excerpt: string }> } };
    expect(akoma.body?.articles?.length).toBe(1);
    expect(akoma.body?.articles?.[0]?.excerpt).toBe('Article 1 - contenu');
    expect(akoma.meta?.publication?.consolidated ?? null).toBeNull();
    expect(updates.eli).toBe('loi/2020/05/12/2020-1234/jo/texte');
    expect(sourceUpdateEq).toHaveBeenCalledWith('id', 'src-1');
  });

  it('signs exports with C2PA manifest metadata', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/exports/sign',
      headers: { 'x-user-id': 'user-1' },
      payload: {
        orgId: 'org-1',
        filename: 'analyse.pdf',
        contentSha256: 'a'.repeat(64),
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      keyId: string;
      algorithm: string;
      signature: string;
      manifest: {
        statement_id: string;
        assertions: Array<{ digest: { value: string } }>;
        subject?: { org: string; user: string };
      };
    };

    expect(body.keyId).toBeTruthy();
    expect(body.algorithm).toBe('ed25519');
    expect(body.signature).toMatch(/^[a-zA-Z0-9+/=]+$/);
    expect(body.manifest.statement_id).toBeTruthy();
    expect(body.manifest.assertions[0]?.digest.value).toBe('a'.repeat(64));
    expect(body.manifest.subject?.org).toBe('org-1');
    expect(body.manifest.subject?.user).toBe('user-1');
  });

  it('rejects missing content hash when signing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/exports/sign',
      headers: { 'x-user-id': 'user-1' },
      payload: {
        orgId: 'org-1',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'orgId and contentSha256 are required' });
  });

  it('returns launch collateral bundles', async () => {
    const response = await app.inject({ method: 'GET', url: '/launch/collateral' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      pilotOnboarding: Array<{ title: string }>;
      pricingPacks: Array<{ name: string }>;
      transparency: Array<{ label: string }>;
    };
    expect(body.pilotOnboarding.length).toBeGreaterThan(0);
    expect(body.pricingPacks[0]?.name).toContain('pack');
    expect(body.transparency.some((item) => item.label.toLowerCase().includes('cepej'))).toBe(true);
  });

  it('enqueues regulator digests and summarises SLO metrics', async () => {
    const postResponse = await app.inject({
      method: 'POST',
      url: '/launch/digests',
      payload: {
        jurisdiction: 'FR',
        channel: 'email',
        frequency: 'weekly',
        recipients: ['ops@example.com', 'legal@example.com'],
        topics: ['governance', 'slo'],
        sloSnapshots: [
          {
            captured_at: '2024-03-10T00:00:00Z',
            api_uptime_percent: 99.92,
            hitl_response_p95_seconds: 180,
            retrieval_latency_p95_seconds: 140,
            citation_precision_p95: 0.97,
          },
          {
            captured_at: '2024-03-09T00:00:00Z',
            api_uptime_percent: 99.5,
            hitl_response_p95_seconds: 190,
            retrieval_latency_p95_seconds: 160,
            citation_precision_p95: 0.96,
          },
        ],
      },
    });

    expect(postResponse.statusCode).toBe(201);
    const postBody = postResponse.json() as { digest: { id: string; sloSummary: { snapshots: number; apiUptimeP95: number | null } } };
    expect(postBody.digest.id).toBeTruthy();
    expect(postBody.digest.sloSummary.snapshots).toBe(2);
    expect(postBody.digest.sloSummary.apiUptimeP95).toBeGreaterThan(0);

    const listResponse = await app.inject({ method: 'GET', url: '/launch/digests' });
    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json() as { digests: Array<{ jurisdiction: string; recipients: string[] }> };
    expect(listBody.digests[0]?.jurisdiction).toBe('FR');
    expect(listBody.digests[0]?.recipients.length).toBe(2);
  });

  it('returns a launch readiness snapshot for the org', async () => {
    __resetWebVitalsForTests();
    enqueueOfflineOutboxItem({
      orgId: 'org-1',
      channel: 'export',
      label: 'Offline export',
      locale: 'fr',
    });

    const readinessResponse = await app.inject({
      method: 'GET',
      url: '/launch/readiness?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(readinessResponse.statusCode).toBe(200);
    const body = readinessResponse.json() as { readinessScore: number; offlineOutbox: { queued: number } };
    expect(body.readinessScore).toBeGreaterThan(0);
    expect(body.offlineOutbox.queued).toBeGreaterThanOrEqual(1);
  });

  it('allows creating and updating offline outbox items', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/launch/offline-outbox',
      headers: { 'x-user-id': 'user-1' },
      payload: {
        orgId: 'org-1',
        channel: 'filing',
        label: 'Offline filing',
        locale: 'fr',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json() as { item: { id: string } };

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/launch/offline-outbox/${created.item.id}`,
      headers: { 'x-user-id': 'user-1' },
      payload: { orgId: 'org-1', status: 'syncing' },
    });

    expect(updateResponse.statusCode).toBe(200);
    const updated = updateResponse.json() as { item: { status: string } };
    expect(updated.item.status).toBe('syncing');

    const listResponse = await app.inject({
      method: 'GET',
      url: '/launch/offline-outbox?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json() as { items: Array<{ id: string }> };
    expect(listBody.items.length).toBeGreaterThanOrEqual(1);
  });
});
