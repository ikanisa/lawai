import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const storageFromMock = vi.fn();

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: storageFromMock },
};

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
    insert: vi.fn(() => Promise.resolve(result)),
    delete: vi.fn(() => builder),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(result),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    upsert: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

vi.mock('../src/access-control.ts', () => ({
  authorizeAction: vi.fn(async (_action: string, orgId: string, userId: string) => ({
    orgId,
    userId,
    role: 'admin',
    policies: { confidentialMode: false },
  })),
  ensureOrgAccessCompliance: vi.fn((ctx: unknown) => ctx),
}));

// no-op device session recording in tests
vi.mock('../src/device-sessions.ts', () => ({
  recordDeviceSession: vi.fn(async () => undefined),
}));

const { app } = await import('../src/server.ts');

describe('Telemetry route', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    storageFromMock.mockReset();
  });

  it('rejects missing fields with 400', async () => {
    supabaseMock.from.mockReturnValue(createQueryBuilder({ data: null, error: null }));
    const response = await app.inject({
      method: 'POST',
      url: '/telemetry',
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it('accepts valid payload and stores event', async () => {
    supabaseMock.from.mockReturnValue(createQueryBuilder({ data: null, error: null }));
    const payload = {
      orgId: '00000000-0000-0000-0000-000000000000',
      userId: '00000000-0000-0000-0000-000000000000',
      eventName: 'web_vital',
      payload: { metric: 'LCP', value: 2500 },
    };
    const response = await app.inject({ method: 'POST', url: '/telemetry', payload });
    expect(response.statusCode).toBe(204);
    // ensure insert called on ui_telemetry_events
    const calls = supabaseMock.from.mock.calls.map((c) => c[0]);
    expect(calls).toContain('ui_telemetry_events');
  });

  it('applies rate limiting with 429 after threshold', async () => {
    supabaseMock.from.mockReturnValue(createQueryBuilder({ data: null, error: null }));
    const payload = {
      orgId: '00000000-0000-0000-0000-000000000000',
      userId: '00000000-0000-0000-0000-000000000000',
      eventName: 'web_vital',
      payload: { metric: 'CLS', value: 0.03 },
    };
    let status429 = 0;
    for (let i = 0; i < 65; i++) {
      const res = await app.inject({ method: 'POST', url: '/telemetry', payload, headers: { 'x-forwarded-for': '1.2.3.4' } });
      if (res.statusCode === 429) {
        status429 += 1;
        break;
      }
    }
    expect(status429).toBe(1);
  });
});

