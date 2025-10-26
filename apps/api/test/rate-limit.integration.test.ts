import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

process.env.NODE_ENV = 'test';

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: vi.fn() },
};

function createQueryBuilder(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => Promise.resolve({ data: null, error: null })),
    delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

const authorizeRequestWithGuardsMock = vi.fn(async () => ({
  orgId: 'org-1',
  userId: 'user-1',
  role: 'member',
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
  entitlements: new Map(),
  ipAllowlistCidrs: [],
  consent: { requirement: null },
  councilOfEurope: { requirement: null },
}));

vi.mock('../src/http/authorization.js', () => ({
  authorizeRequestWithGuards: authorizeRequestWithGuardsMock,
}));

const runLegalAgentMock = vi.fn(async () => ({
  runId: 'run-123',
  payload: {
    question: 'Test question',
    jurisdiction: {},
    citations: [],
    risk: { level: 'low' },
  },
  notices: [],
}));

vi.mock('../src/agent-wrapper.js', () => ({
  runLegalAgent: runLegalAgentMock,
  getHybridRetrievalContext: vi.fn(async () => ({ results: [] })),
}));

const envKeys = [
  'RATE_LIMIT_ENABLED',
  'RATE_LIMIT_PROVIDER',
  'RATE_LIMIT_RUNS_LIMIT',
  'RATE_LIMIT_RUNS_WINDOW_SECONDS',
  'RATE_LIMIT_WORKSPACE_LIMIT',
  'RATE_LIMIT_WORKSPACE_WINDOW_SECONDS',
  'RATE_LIMIT_COMPLIANCE_LIMIT',
  'RATE_LIMIT_COMPLIANCE_WINDOW_SECONDS',
  'RATE_LIMIT_TELEMETRY_LIMIT',
  'RATE_LIMIT_TELEMETRY_WINDOW_SECONDS',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
];

let originalEnv: Record<string, string | undefined> = {};
let app: FastifyInstance;

describe('rate limiting integration', () => {
  beforeEach(async () => {
    vi.resetModules();
    originalEnv = {};
    for (const key of envKeys) {
      originalEnv[key] = process.env[key];
    }

    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.RATE_LIMIT_PROVIDER = 'memory';
    process.env.RATE_LIMIT_RUNS_LIMIT = '1';
    process.env.RATE_LIMIT_RUNS_WINDOW_SECONDS = '60';
    process.env.RATE_LIMIT_WORKSPACE_LIMIT = '1';
    process.env.RATE_LIMIT_WORKSPACE_WINDOW_SECONDS = '60';
    process.env.RATE_LIMIT_COMPLIANCE_LIMIT = '1';
    process.env.RATE_LIMIT_COMPLIANCE_WINDOW_SECONDS = '60';
    process.env.RATE_LIMIT_TELEMETRY_LIMIT = '10';
    process.env.RATE_LIMIT_TELEMETRY_WINDOW_SECONDS = '60';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
    process.env.SUPABASE_URL = 'https://example.supabase.co';

    supabaseMock.from.mockImplementation(() => createQueryBuilder());
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    supabaseMock.storage.from.mockReturnValue({});
    authorizeRequestWithGuardsMock.mockClear();
    runLegalAgentMock.mockClear();

    ({ app } = await import('../src/server.ts'));
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    supabaseMock.storage.from.mockReset();
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  const orgId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = 'f9f38a54-8f79-4eb5-8e47-97931f8b8d7d';

  it('limits POST /runs requests when quota is exhausted', async () => {
    const payload = {
      question: 'What are the filing requirements?',
      orgId,
      userId,
    };

    const first = await app.inject({
      method: 'POST',
      url: '/runs',
      payload,
      headers: { 'content-type': 'application/json' },
    });

    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/runs',
      payload,
      headers: { 'content-type': 'application/json' },
    });
    expect(second.statusCode).toBe(429);
    expect(second.json()).toMatchObject({ error: 'rate_limited', scope: 'runs' });
  });

  it('limits GET /workspace per org/user combination', async () => {
    const headers = { 'x-user-id': userId };
    const first = await app.inject({ method: 'GET', url: `/workspace?orgId=${orgId}`, headers });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: 'GET', url: `/workspace?orgId=${orgId}`, headers });
    expect(second.statusCode).toBe(429);
    expect(second.json()).toMatchObject({ error: 'rate_limited', scope: 'workspace' });
  });

  it('limits compliance acknowledgement reads after threshold', async () => {
    const headers = { 'x-user-id': userId, 'x-org-id': orgId };
    const first = await app.inject({ method: 'GET', url: '/compliance/acknowledgements', headers });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: 'GET', url: '/compliance/acknowledgements', headers });
    expect(second.statusCode).toBe(429);
    expect(second.json()).toMatchObject({ error: 'rate_limited', scope: 'compliance' });
  });
});
