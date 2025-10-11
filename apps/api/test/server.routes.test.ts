import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const storageFromMock = vi.fn();

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: storageFromMock },
};

const summariseDocumentFromPayloadMock = vi.fn();

const enqueueDirectorCommandMock = vi.fn();
const getCommandEnvelopeMock = vi.fn();
const runSafetyAssessmentMock = vi.fn();
const updateCommandStatusMock = vi.fn();
const updateJobStatusMock = vi.fn();
const listPendingJobsMock = vi.fn();
const registerConnectorMock = vi.fn();
const listCommandsForSessionMock = vi.fn();
const listOrgConnectorsMock = vi.fn();

let baseEnvelope: any;

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

vi.mock('../src/access-control.ts', () => ({
  authorizeAction: vi.fn(async () => ({ orgId: 'org-1', actorId: 'user-1' })),
  ensureOrgAccessCompliance: vi.fn((ctx: unknown) => ctx),
}));

vi.mock('../src/audit.ts', () => ({
  logAuditEvent: vi.fn(async () => undefined),
}));

vi.mock('../src/summarization.ts', () => ({
  summariseDocumentFromPayload: summariseDocumentFromPayloadMock,
}));

vi.mock('../src/orchestrator.ts', () => ({
  enqueueDirectorCommand: enqueueDirectorCommandMock,
  getCommandEnvelope: getCommandEnvelopeMock,
  runSafetyAssessment: runSafetyAssessmentMock,
  updateCommandStatus: updateCommandStatusMock,
  updateJobStatus: updateJobStatusMock,
  listPendingJobs: listPendingJobsMock,
  registerConnector: registerConnectorMock,
  listCommandsForSession: listCommandsForSessionMock,
  listOrgConnectors: listOrgConnectorsMock,
}));

const { app } = await import('../src/server.ts');

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    __result: result,
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
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
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    storageFromMock.mockReset();
    summariseDocumentFromPayloadMock.mockReset();
    enqueueDirectorCommandMock.mockReset();
    getCommandEnvelopeMock.mockReset();
    runSafetyAssessmentMock.mockReset();
    updateCommandStatusMock.mockReset();
    updateJobStatusMock.mockReset();
    listPendingJobsMock.mockReset();
    registerConnectorMock.mockReset();
    listCommandsForSessionMock.mockReset();
    listOrgConnectorsMock.mockReset();

    const now = new Date().toISOString();
    enqueueDirectorCommandMock.mockResolvedValue({
      commandId: 'cmd-1',
      jobId: 'job-1',
      sessionId: 'session-1',
      status: 'queued',
      scheduledFor: now,
    });
    baseEnvelope = {
      command: {
        id: 'cmd-1',
        orgId: 'org-1',
        sessionId: 'session-1',
        commandType: 'sync_connector',
        payload: {},
        status: 'queued',
        priority: 100,
        scheduledFor: now,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        result: null,
        lastError: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
      job: {
        id: 'job-1',
        orgId: 'org-1',
        commandId: 'cmd-1',
        worker: 'director',
        domainAgent: null,
        status: 'pending',
        attempts: 0,
        scheduledAt: now,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        lastError: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
      session: {
        id: 'session-1',
        orgId: 'org-1',
        chatSessionId: null,
        status: 'active',
        directorState: {},
        safetyState: {},
        metadata: {},
        currentObjective: null,
        lastDirectorRunId: null,
        lastSafetyRunId: null,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
      },
    };
    getCommandEnvelopeMock.mockResolvedValue(baseEnvelope);
    runSafetyAssessmentMock.mockResolvedValue({ status: 'approved', reasons: [] });
    updateCommandStatusMock.mockResolvedValue(undefined);
    updateJobStatusMock.mockResolvedValue(undefined);
    listPendingJobsMock.mockResolvedValue([]);
    registerConnectorMock.mockResolvedValue('connector-1');
    listCommandsForSessionMock.mockResolvedValue([]);
    listOrgConnectorsMock.mockResolvedValue([
      {
        id: 'conn-erp',
        orgId: 'org-1',
        connectorType: 'erp',
        name: 'payables_module',
        status: 'active',
        config: {},
        metadata: {},
        lastSyncedAt: null,
        lastError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
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

  it('queues orchestrator commands and returns safety outcome', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/agent/commands',
      headers: { 'x-user-id': 'user-1' },
      payload: {
        orgId: 'org-1',
        commandType: 'sync_connector',
        payload: { connector: 'erp' },
      },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json() as {
      commandId: string;
      jobId: string;
      sessionId: string;
      safety: { status: string };
    };
    expect(body.commandId).toBe('cmd-1');
    expect(body.jobId).toBe('job-1');
    expect(body.sessionId).toBe('session-1');
    expect(body.safety.status).toBe('approved');
    expect(enqueueDirectorCommandMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orgId: 'org-1',
        commandType: 'sync_connector',
        issuedBy: 'user-1',
      }),
      expect.anything(),
    );
    expect(getCommandEnvelopeMock).toHaveBeenCalledWith(expect.anything(), 'cmd-1');
    expect(runSafetyAssessmentMock).toHaveBeenCalled();
  });

  it('rejects orchestrator command when safety blocks it', async () => {
    runSafetyAssessmentMock.mockResolvedValueOnce({ status: 'rejected', reasons: ['policy_violation'] });

    const response = await app.inject({
      method: 'POST',
      url: '/agent/commands',
      headers: { 'x-user-id': 'user-1' },
      payload: {
        orgId: 'org-1',
        commandType: 'issue_payment',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(updateCommandStatusMock).toHaveBeenCalledWith(expect.anything(), 'cmd-1', 'cancelled', expect.objectContaining({
      lastError: 'policy_violation',
    }));
    expect(updateJobStatusMock).toHaveBeenCalledWith(expect.anything(), 'job-1', 'cancelled', expect.objectContaining({
      lastError: 'policy_violation',
    }));
  });

  it('rejects finance domain commands with invalid payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/agent/commands',
      headers: { 'x-user-id': 'user-1' },
      payload: {
        orgId: 'org-1',
        commandType: 'finance.domain',
        payload: { domain: 'tax_compliance' },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(enqueueDirectorCommandMock).not.toHaveBeenCalled();
  });

  it('accepts finance domain commands with valid payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/agent/commands',
      headers: { 'x-user-id': 'user-1' },
      payload: {
        orgId: 'org-1',
        commandType: 'finance.domain',
        payload: {
          intent: 'tax.prepare_filing',
          domain: 'tax_compliance',
          objective: 'Préparer le dépôt TVA Q1',
          inputs: { jurisdiction: 'FR', period: '2025-Q1' },
        },
      },
    });

    expect(response.statusCode).toBe(202);
    const call = enqueueDirectorCommandMock.mock.calls.at(-1);
    expect(call?.[1]).toMatchObject({
      payload: {
        intent: 'tax.prepare_filing',
        domain: 'tax_compliance',
        objective: 'Préparer le dépôt TVA Q1',
        inputs: { jurisdiction: 'FR', period: '2025-Q1' },
        guardrails: [],
        telemetry: [],
      },
    });
  });

  it('registers connectors for an organisation', async () => {
    registerConnectorMock.mockResolvedValueOnce('connector-42');

    const response = await app.inject({
      method: 'POST',
      url: '/agent/connectors',
      headers: { 'x-user-id': 'user-1' },
      payload: {
        orgId: 'org-1',
        connectorType: 'erp',
        name: 'netsuite',
        config: { account: 'suite' },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ connectorId: 'connector-42' });
    expect(registerConnectorMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      orgId: 'org-1',
      connectorType: 'erp',
      name: 'netsuite',
      createdBy: 'user-1',
    }));
  });

  it('returns finance capability manifest with connector coverage', async () => {
    listOrgConnectorsMock.mockResolvedValueOnce([
      {
        id: 'conn-erp',
        orgId: 'org-1',
        connectorType: 'erp',
        name: 'payables_module',
        status: 'active',
        config: {},
        metadata: {},
        lastSyncedAt: null,
        lastError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'conn-tax',
        orgId: 'org-1',
        connectorType: 'tax',
        name: 'tax_authority_gateway',
        status: 'pending',
        config: {},
        metadata: {},
        lastSyncedAt: null,
        lastError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/agent/capabilities?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      manifest: { version: string };
      connectors: { coverage: Array<{ key: string; missing: string[] }> };
    };
    expect(body.manifest.version).toContain('phase');
    const taxCoverage = body.connectors.coverage.find((entry) => entry.key === 'tax_compliance');
    expect(taxCoverage).toBeDefined();
    expect(taxCoverage?.missing).toContain('tax_authority_gateway');
    const apCoverage = body.connectors.coverage.find((entry) => entry.key === 'accounts_payable');
    expect(apCoverage?.missing).toHaveLength(0);
    expect(listOrgConnectorsMock).toHaveBeenCalledWith(expect.anything(), 'org-1');
  });

  it('claims orchestrator jobs when pending work exists', async () => {
    listPendingJobsMock.mockResolvedValueOnce([baseEnvelope]);

    const response = await app.inject({
      method: 'POST',
      url: '/agent/jobs/claim',
      headers: { 'x-user-id': 'user-1' },
      payload: { orgId: 'org-1', worker: 'director' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { envelope: { job: { status: string } } };
    expect(body.envelope.job.status).toBe('running');
    expect(updateJobStatusMock).toHaveBeenCalledWith(expect.anything(), 'job-1', 'running', expect.objectContaining({
      attempts: 1,
      metadata: expect.objectContaining({ claimedBy: 'user-1' }),
    }));
    expect(updateCommandStatusMock).toHaveBeenCalledWith(expect.anything(), 'cmd-1', 'in_progress', expect.objectContaining({
      startedAt: expect.any(String),
    }));
  });

  it('returns 204 when no orchestrator job is available', async () => {
    listPendingJobsMock.mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'POST',
      url: '/agent/jobs/claim',
      headers: { 'x-user-id': 'user-1' },
      payload: { orgId: 'org-1', worker: 'director' },
    });

    expect(response.statusCode).toBe(204);
    expect(updateJobStatusMock).not.toHaveBeenCalled();
  });

  it('completes orchestrator jobs and updates command status', async () => {
    const jobRow = {
      id: 'job-42',
      org_id: 'org-1',
      command_id: 'cmd-42',
      metadata: {},
      status: 'running',
    };
    const jobBuilder = createQueryBuilder({ data: jobRow, error: null });
    jobBuilder.select.mockReturnValue(jobBuilder);
    jobBuilder.eq.mockReturnValue(jobBuilder);
    jobBuilder.maybeSingle.mockResolvedValue({ data: jobRow, error: null });

    const commandRow = {
      command_type: 'finance.domain',
      payload: {
        intent: 'tax.prepare_filing',
        domain: 'tax_compliance',
        objective: 'Préparer le dépôt TVA Q1',
        inputs: {},
        guardrails: [],
        telemetry: [],
        connectors: {},
      },
    };

    const commandBuilder = createQueryBuilder({ data: commandRow, error: null });
    commandBuilder.select.mockReturnValue(commandBuilder);
    commandBuilder.eq.mockReturnValue(commandBuilder);
    commandBuilder.maybeSingle.mockResolvedValue({ data: commandRow, error: null });

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'orchestrator_jobs') {
        return jobBuilder;
      }
      if (table === 'orchestrator_commands') {
        return commandBuilder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'POST',
      url: '/agent/jobs/job-42/complete',
      headers: { 'x-user-id': 'user-1' },
      payload: { status: 'completed', result: { output: { ok: true } } },
    });

    expect(response.statusCode).toBe(200);
    expect(updateJobStatusMock).toHaveBeenCalledWith(expect.anything(), 'job-42', 'completed', expect.objectContaining({
      completedAt: expect.any(String),
    }));
    expect(updateCommandStatusMock).toHaveBeenCalledWith(expect.anything(), 'cmd-42', 'completed', expect.objectContaining({
      completedAt: expect.any(String),
      result: { output: { ok: true }, notices: [], followUps: [] },
    }));
  });

  it('lists orchestrator commands for a session', async () => {
    listCommandsForSessionMock.mockResolvedValueOnce([
      {
        id: 'cmd-1',
        orgId: 'org-1',
        sessionId: 'session-1',
        commandType: 'sync_connector',
        payload: {},
        status: 'queued',
        priority: 100,
        scheduledFor: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        failedAt: null,
        result: null,
        lastError: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/agent/sessions/session-1/commands?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { commands: Array<{ id: string }> };
    expect(body.commands).toHaveLength(1);
    expect(listCommandsForSessionMock).toHaveBeenCalledWith(expect.anything(), 'session-1', 50);
  });

  it('summarises operations readiness and go/no-go criteria', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      switch (table) {
        case 'slo_snapshots':
          return createQueryBuilder({
            data: [
              {
                captured_at: '2024-09-10T08:00:00Z',
                api_uptime_percent: 99.95,
                hitl_response_p95_seconds: 420,
                retrieval_latency_p95_seconds: 9,
                citation_precision_p95: 0.97,
                notes: 'Monthly capture',
              },
            ],
            error: null,
          });
        case 'incident_reports':
          return createQueryBuilder({
            data: [
              {
                id: 'incident-1',
                occurred_at: '2024-09-05T12:00:00Z',
                detected_at: '2024-09-05T12:05:00Z',
                resolved_at: '2024-09-05T13:00:00Z',
                severity: 'medium',
                status: 'closed',
                title: 'Reviewer backlog spike',
                summary: 'Temporary backlog mitigated with on-call reviewers.',
                impact: 'Response time > SLA for 25 minutes.',
                resolution: 'Added reviewer capacity and tuned escalation thresholds.',
                follow_up: 'Automate pre-emptive scaling.',
                evidence_url: 'https://example.test/incident',
                recorded_at: '2024-09-05T13:05:00Z',
              },
            ],
            error: null,
          });
        case 'change_log_entries':
          return createQueryBuilder({
            data: [
              {
                id: 'change-1',
                entry_date: '2024-09-08',
                title: 'Updated incident playbook',
                category: 'policy',
                summary: 'Refreshed notification matrix and tooling.',
                release_tag: '2024.09',
                links: null,
                recorded_at: '2024-09-08T09:00:00Z',
              },
            ],
            error: null,
          });
        case 'go_no_go_evidence':
          return createQueryBuilder({
            data: [
              {
                id: 'evidence-1',
                section: 'H',
                criterion: 'SLO snapshots capturés',
                status: 'satisfied',
                evidence_url: 'https://example.test/slo',
                notes: { auto: true },
              },
            ],
            error: null,
          });
        case 'governance_publications': {
          const builder = createQueryBuilder({
            data: { slug: 'regulator-outreach-plan', status: 'published' },
            error: null,
          });
          builder.select.mockReturnValue(builder);
          builder.eq.mockReturnValue(builder);
          return builder;
        }
        default:
          throw new Error(`unexpected table ${table}`);
      }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/org/org-1/operations/overview',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      slo: { summary: { snapshots: number | null } };
      goNoGo: { criteria: Array<{ criterion: string; recordedStatus: string }> };
      incidents: { total: number; entries: Array<{ id: string }> };
    };
    expect(body.slo.summary.snapshots).toBe(1);
    expect(body.incidents.total).toBe(1);
    const sloCriterion = body.goNoGo.criteria.find((item) => item.criterion === 'SLO snapshots capturés');
    expect(sloCriterion?.recordedStatus).toBe('satisfied');
  });

  it('filters audit events when object and runId are provided', async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'audit_events') {
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/org/org-1/audit-events?object=hitl-123&runId=run-456',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(builder.eq).toHaveBeenCalledWith('object', 'hitl-123');
    expect(builder.eq).toHaveBeenCalledWith('metadata->>run_id', 'run-456');
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
            },
            {
              jurisdiction: 'MA',
              evaluation_count: 2,
              pass_rate: 0.5,
              citation_precision_median: 0.92,
              temporal_validity_median: 0.9,
              avg_binding_warnings: 1,
              maghreb_banner_coverage: 1,
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
      summary: { totalCases: number; evaluatedResults: number; passRate: number | null } | null;
      jurisdictions: Array<{ jurisdiction: string }>;
    };
    expect(body.summary).toMatchObject({ totalCases: 12, evaluatedResults: 9, passRate: 0.75 });
    expect(body.jurisdictions).toHaveLength(2);
    expect(body.jurisdictions[0].jurisdiction).toBe('FR');
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
              jurisdiction_code: 'FR',
              residency_zone: 'eu',
              total_sources: 2,
              sources_consolidated: 2,
              sources_with_binding: 2,
              sources_with_language_note: 1,
              sources_with_eli: 2,
              sources_with_ecli: 1,
              sources_with_akoma: 2,
              binding_breakdown: { fr: 2 },
              source_type_breakdown: { statute: 2 },
              language_note_breakdown: { 'version consolidée': 1 },
            },
            {
              jurisdiction_code: 'OHADA',
              residency_zone: 'ohada',
              total_sources: 3,
              sources_consolidated: 3,
              sources_with_binding: 3,
              sources_with_language_note: 0,
              sources_with_eli: 0,
              sources_with_ecli: 0,
              sources_with_akoma: 3,
              binding_breakdown: { fr: 3 },
              source_type_breakdown: { statute: 3 },
              language_note_breakdown: {},
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
    const body = response.json() as {
      identifiers: Array<{ jurisdiction: string; sourcesTotal: number }>;
      jurisdictions: Array<{ jurisdiction: string; residencyZone: string }>;
    };
    expect(body.identifiers).toHaveLength(1);
    expect(body.identifiers[0]).toMatchObject({ jurisdiction: 'FR', sourcesTotal: 2, sourcesWithEli: 2 });
    expect(body.jurisdictions).toHaveLength(2);
    expect(body.jurisdictions[0]).toMatchObject({ jurisdiction: 'FR', residencyZone: 'eu', totalSources: 2 });
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
                windowStart: '2024-09-02T00:00:00Z',
                windowEnd: '2024-09-03T00:00:00Z',
                overall: { totalRuns: 10, hitlRate: 0.3, highRiskShare: 0.2, benchmarkRate: 0.8 },
                jurisdictions: [
                  { code: 'FR', totalRuns: 6, hitlEscalations: 3, hitlRate: 0.5, highRiskShare: 0.25 },
                  { code: 'OHADA', totalRuns: 4, hitlEscalations: 1, hitlRate: 0.25, highRiskShare: 0.15 },
                ],
                benchmarks: [{ name: 'legalbench', evaluated: 6, passRate: 0.7 }],
                flagged: { jurisdictions: ['FR'], benchmarks: ['legalbench'] },
              },
            },
            {
              kind: 'fairness',
              report_date: '2024-09-02',
              payload: {
                capturedAt: '2024-09-02T10:00:00Z',
                windowStart: '2024-09-01T00:00:00Z',
                windowEnd: '2024-09-02T00:00:00Z',
                overall: { totalRuns: 8, hitlRate: 0.25, highRiskShare: 0.1, benchmarkRate: 0.75 },
                jurisdictions: [{ code: 'FR', totalRuns: 4, hitlEscalations: 2, hitlRate: 0.5, highRiskShare: 0.2 }],
                benchmarks: [{ name: 'lexglue', evaluated: 4, passRate: 0.6 }],
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
        fairness:
          | {
              overall?: Record<string, unknown> | null;
              flagged: { jurisdictions: string[]; benchmarks: string[] };
              jurisdictions: Array<Record<string, unknown>>;
              trend?: Array<Record<string, unknown>>;
            }
          | null;
      };
    };
    expect(body.metrics.queue?.pending).toBe(3);
    expect(body.metrics.queue?.byType?.indexing_ticket).toBe(2);
    expect(body.metrics.drift?.hitlEscalations).toBe(3);
    expect(body.metrics.drift?.allowlistedRatio).toBeCloseTo(0.9);
    expect(body.metrics.fairness?.flagged.jurisdictions).toContain('FR');
    const overall = body.metrics.fairness?.overall as Record<string, unknown> | undefined;
    expect(typeof overall?.hitlRate).toBe('number');
    expect((overall?.hitlRate as number | undefined) ?? 0).toBeCloseTo(0.3);
    expect(Array.isArray(body.metrics.fairness?.jurisdictions)).toBe(true);
    expect(body.metrics.fairness?.jurisdictions[0]).toMatchObject({ code: 'FR' });
    expect((body.metrics.fairness?.trend ?? []).length).toBeGreaterThan(0);
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
      select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) })),
    };

    const documentSummariesTable = {
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { summary: 'Ancien résumé', outline: [] }, error: null })) })) })),
      upsert: vi.fn(async () => ({ error: null })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
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
});
