import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const supabaseMock = { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } };

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

const noopRoute = async () => undefined;

vi.mock('../../src/routes/agents/index.js', () => ({ registerAgentsRoutes: vi.fn(noopRoute) }));
vi.mock('../../src/routes/research/index.js', () => ({ registerResearchRoutes: vi.fn(noopRoute) }));
vi.mock('../../src/routes/citations/index.js', () => ({ registerCitationsRoutes: vi.fn(noopRoute) }));
vi.mock('../../src/routes/corpus/index.js', () => ({ registerCorpusRoutes: vi.fn(noopRoute) }));
vi.mock('../../src/routes/matters/index.js', () => ({ registerMattersRoutes: vi.fn(noopRoute) }));
vi.mock('../../src/routes/hitl/index.js', () => ({ registerHitlRoutes: vi.fn(noopRoute) }));
vi.mock('../../src/routes/deadline/index.js', () => ({ registerDeadlineRoutes: vi.fn(noopRoute) }));
vi.mock('../../src/routes/upload/index.js', () => ({ registerUploadRoutes: vi.fn(noopRoute) }));
vi.mock('../../src/routes/voice/index.js', () => ({ registerVoiceRoutes: vi.fn(noopRoute) }));
vi.mock('../../src/routes/realtime/index.js', () => ({ registerRealtimeRoutes: vi.fn(noopRoute) }));

const createAccessContext = (orgId = 'org-test', userId = 'user-test') => ({
  orgId,
  userId,
  role: 'admin' as const,
  policies: {
    confidentialMode: false,
    franceJudgeAnalyticsBlocked: false,
    mfaRequired: false,
    ipAllowlistEnforced: false,
    consentRequirement: null,
    councilOfEuropeRequirement: null,
    sensitiveTopicHitl: false,
    residencyZone: null,
    residencyZones: null,
  },
  rawPolicies: {},
  entitlements: new Map<string, { canRead: boolean; canWrite: boolean }>(),
  ipAllowlistCidrs: [],
  consent: { requirement: null, latest: null },
  councilOfEurope: { requirement: null, acknowledgedVersion: null },
});

const authorizeRequestWithGuards = vi.fn(async (_action: string, orgId: string, userId: string) =>
  createAccessContext(orgId, userId),
);

vi.mock('../../src/http/authorization.js', () => ({
  authorizeRequestWithGuards,
}));

vi.mock('../../src/access-control.ts', () => ({
  authorizeAction: vi.fn(async () => createAccessContext()),
  ensureOrgAccessCompliance: vi.fn((ctx: unknown) => ctx),
}));

vi.mock('../../src/device-sessions.ts', () => ({
  recordDeviceSession: vi.fn(async () => undefined),
}));

vi.mock('../../src/audit.ts', () => ({
  logAuditEvent: vi.fn(async () => undefined),
}));

vi.mock('../../src/routes/citations/data.ts', () => ({
  cloneCitationsData: () => ({ results: [], ohadaFeatured: [] }),
  getCitationById: () => undefined,
}));

vi.mock('../../src/routes/research/data.ts', () => ({
  researchDeskContext: {
    plan: null,
    filters: {},
    defaultCitations: [],
    suggestions: [],
  },
  createResearchStream: vi.fn(() => []),
}));

vi.mock('../../src/summarization.ts', () => ({
  summariseDocumentFromPayload: vi.fn(async () => undefined),
}));

vi.mock('../../src/orchestrator.ts', () => ({
  enqueueDirectorCommand: vi.fn(async () => ({ id: 'cmd', status: 'queued' })),
  getCommandEnvelope: vi.fn(async () => ({ command: {}, job: {}, session: {} })),
  runSafetyAssessment: vi.fn(async () => ({ status: 'approved', reasons: [] })),
  updateCommandStatus: vi.fn(async () => undefined),
  updateJobStatus: vi.fn(async () => undefined),
  listPendingJobs: vi.fn(async () => []),
  registerConnector: vi.fn(async () => 'connector'),
  listCommandsForSession: vi.fn(async () => []),
  listOrgConnectors: vi.fn(async () => []),
}));

vi.mock('../../src/core/lifecycle/graceful-shutdown.ts', () => ({
  registerGracefulShutdown: vi.fn(),
}));

const ORG_ID = '00000000-0000-0000-0000-000000000123';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

type WorkspaceQueryResult = { data: unknown; error: unknown };

const queryFactories = new Map<string, () => WorkspaceQueryResult>();

function createQueryBuilder(result: WorkspaceQueryResult) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: WorkspaceQueryResult) => unknown) => Promise.resolve(result).then(resolve),
    catch: (reject: (reason: unknown) => unknown) => Promise.resolve(result).catch(reject),
    finally: (onFinally: () => void) => Promise.resolve(result).finally(onFinally),
  };
  return builder;
}

supabaseMock.from.mockImplementation((table: string) => {
  const factory = queryFactories.get(table);
  const result = factory ? factory() : { data: [], error: null };
  return createQueryBuilder(result);
});

function setWorkspaceQueryData() {
  const jurisdictions = [
    { code: 'FR', name: 'France', eu: true, ohada: false },
    { code: 'OH', name: 'OHADA', eu: false, ohada: true },
  ];
  const matters = [
    {
      id: 'run-1',
      question: 'Synthèse assignation Paris',
      risk_level: 'medium',
      hitl_required: true,
      status: 'completed',
      started_at: '2024-01-01T09:00:00.000Z',
      finished_at: '2024-01-01T09:30:00.000Z',
      jurisdiction_json: { country: 'FR' },
    },
    {
      id: 'run-2',
      question: 'Analyse recouvrement OHADA',
      risk_level: 'high',
      hitl_required: false,
      status: 'pending',
      started_at: '2024-01-02T11:00:00.000Z',
      finished_at: null,
      jurisdiction_json: { country: 'OH' },
    },
  ];
  const sources = [
    {
      id: 'src-1',
      title: 'CEPEJ 2024 updates',
      publisher: 'CEPEJ',
      source_url: 'https://example.org/cepej',
      jurisdiction_code: 'FR',
      consolidated: true,
      effective_date: '2024-01-01',
      created_at: '2024-01-03T10:00:00.000Z',
    },
  ];
  const hitl = [
    {
      id: 'hitl-1',
      run_id: 'run-2',
      reason: 'confidential_evidence',
      status: 'pending',
      created_at: '2024-01-02T12:00:00.000Z',
    },
    {
      id: 'hitl-2',
      run_id: 'run-3',
      reason: 'policy_review',
      status: 'approved',
      created_at: '2024-01-04T12:00:00.000Z',
    },
  ];

  queryFactories.set('jurisdictions', () => ({ data: clone(jurisdictions), error: null }));
  queryFactories.set('agent_runs', () => ({ data: clone(matters), error: null }));
  queryFactories.set('sources', () => ({ data: clone(sources), error: null }));
  queryFactories.set('hitl_queue', () => ({ data: clone(hitl), error: null }));
}

beforeEach(() => {
  supabaseMock.from.mockClear();
  queryFactories.clear();
});

afterEach(() => {
  queryFactories.clear();
});

describe('workspace domain routes', () => {
  it('returns the same payload as the legacy /workspace endpoint', async () => {
    setWorkspaceQueryData();

    const { createApp } = await import('../../src/app.js');
    const domainCreated = await createApp();
    await domainCreated.app.ready();
    const domainResponse = await domainCreated.app.inject({
      method: 'GET',
      url: `/workspace?orgId=${ORG_ID}`,
      headers: { 'x-user-id': 'user-domain' },
    });
    expect(domainResponse.statusCode).toBe(200);
    const domainPayload = domainResponse.json();
    await domainCreated.app.close();

    // Reset fixtures for the legacy app invocation
    setWorkspaceQueryData();

    const legacy = await import('../../src/server.ts');
    await legacy.app.ready();
    const legacyResponse = await legacy.app.inject({
      method: 'GET',
      url: `/workspace?orgId=${ORG_ID}`,
      headers: { 'x-user-id': 'user-legacy' },
    });
    expect(legacyResponse.statusCode).toBe(200);
    const legacyPayload = legacyResponse.json();
    await legacy.app.close();

    // Parity ensures both implementations expose the same workspace payload shape
    expect(domainPayload).toEqual(legacyPayload);
    expect(domainPayload.desk?.playbooks?.length).toBeGreaterThan(0);
    expect(domainPayload.navigator?.length).toBeGreaterThan(0);
    expect(domainPayload.hitlInbox?.pendingCount).toBe(1);
  });

  it('logs supabase errors while still returning fallback data', async () => {
    const errorSpy = vi.fn();

    queryFactories.set('jurisdictions', () => ({ data: [], error: { message: 'jurisdiction failed' } }));
    queryFactories.set('agent_runs', () => ({ data: [], error: new Error('matters failed') }));
    queryFactories.set('sources', () => ({
      data: [
        {
          id: 'src-err',
          title: 'Fallback',
          publisher: 'OPS',
          source_url: 'https://example.org/fallback',
          jurisdiction_code: 'FR',
          consolidated: false,
          effective_date: null,
          created_at: '2024-02-01T00:00:00.000Z',
        },
      ],
      error: null,
    }));
    queryFactories.set('hitl_queue', () => ({ data: [], error: null }));

    const { createApp } = await import('../../src/app.js');
    const scopedApp = await createApp();
    scopedApp.app.addHook('onRequest', (request, _reply, done) => {
      const original = request.log.error.bind(request.log);
      request.log.error = ((payload: unknown, message: string) => {
        errorSpy(payload, message);
        return original(payload, message);
      }) as typeof request.log.error;
      done();
    });
    await scopedApp.app.ready();

    const response = await scopedApp.app.inject({
      method: 'GET',
      url: `/workspace?orgId=${ORG_ID}`,
      headers: { 'x-user-id': 'user-domain' },
    });
    expect(response.statusCode).toBe(206);
    const payload = response.json();
    expect(payload.meta.status).toBe('partial');
    expect(payload.complianceWatch).toHaveLength(1);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.anything(), orgId: ORG_ID }),
      'workspace_jurisdictions_query_failed',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.anything(), orgId: ORG_ID }),
      'workspace_matters_query_failed',
    );

    await scopedApp.app.close();
  });
  it('rejects requests without a user identifier', async () => {
    const { createApp } = await import('../../src/app.js');
    const { app } = await createApp();
    await app.ready();

    const response = await app.inject({ method: 'GET', url: `/workspace?orgId=${ORG_ID}` });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'x-user-id header is required' });

    await app.close();
  });
});
