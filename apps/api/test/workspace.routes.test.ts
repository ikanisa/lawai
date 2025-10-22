import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const supabaseMock = { from: vi.fn(), rpc: vi.fn() };

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

const authorizeRequestWithGuards = vi.fn(async (_action: string, orgId: string, userId: string) => ({
  orgId,
  userId,
  role: 'member',
  policies: {
    confidentialMode: false,
    franceJudgeAnalyticsBlocked: false,
    mfaRequired: false,
    ipAllowlistEnforced: false,
    consentRequirement: { type: 'ai_assist', version: '2024-10-01' },
    councilOfEuropeRequirement: null,
    sensitiveTopicHitl: false,
    residencyZone: null,
    residencyZones: null,
  },
  rawPolicies: {},
  entitlements: new Map(),
  ipAllowlistCidrs: [],
  consent: { requirement: { type: 'ai_assist', version: '2024-10-01' }, latest: null },
  councilOfEurope: { requirement: null, acknowledgedVersion: null },
}));

vi.mock('../src/http/authorization.ts', () => ({
  authorizeRequestWithGuards,
}));

vi.mock('../src/device-sessions.ts', () => ({
  recordDeviceSession: vi.fn(async () => undefined),
}));

const { app } = await import('../src/server.ts');

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

describe('workspace compliance acknowledgement routes', () => {
  const recordedEvents: Array<{ consent_type: string; version: string }> = [];

  beforeEach(() => {
    recordedEvents.length = 0;
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    authorizeRequestWithGuards.mockClear();

    supabaseMock.rpc.mockImplementation(async (fn: string, args: { events?: Array<{ consent_type: string; version: string }> }) => {
      if (fn === 'record_consent_events') {
        if (Array.isArray(args?.events)) {
          recordedEvents.push(...args.events.map((event) => ({
            consent_type: event.consent_type,
            version: event.version,
          })));
        }
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'consent_events') {
        const builder: any = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.or = vi.fn(() => builder);
        builder.in = vi.fn(() => builder);
        builder.order = vi.fn(() =>
          Promise.resolve({
            data: recordedEvents.map((event) => ({
              consent_type: event.consent_type,
              version: event.version,
              created_at: new Date().toISOString(),
            })),
            error: null,
          }),
        );
        return builder;
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('records consent acknowledgements with canonical type', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/compliance/acknowledgements',
      headers: { 'x-org-id': ORG_ID, 'x-user-id': USER_ID },
      payload: { consent: { type: 'ai_assist', version: '2024-10-01' } },
    });

    expect(response.statusCode).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'record_consent_events',
      expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({ consent_type: 'ai_assist', version: '2024-10-01' }),
        ]),
      }),
    );
  });

  it('rejects unsupported consent types with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/compliance/acknowledgements',
      headers: { 'x-org-id': ORG_ID, 'x-user-id': USER_ID },
      payload: { consent: { type: 'not-real', version: '2024-10-01' } },
    });

    expect(response.statusCode).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});
