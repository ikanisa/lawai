import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgAccessContext } from '../src/access-control.ts';

process.env.NODE_ENV = 'test';

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
};

function createConsentQuery(result: { data: unknown; error: unknown }) {
  const builder: any = {
    __result: result,
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(result),
  };
  return builder;
}

const authorizeRequestWithGuardsMock = vi.fn<
  [string, string, string, unknown],
  Promise<OrgAccessContext>
>();

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

vi.mock('../src/domain/workspace/routes.ts', () => ({
  registerWorkspaceRoutes: vi.fn(async () => undefined),
}));

vi.mock('../src/http/authorization.ts', () => ({
  authorizeRequestWithGuards: authorizeRequestWithGuardsMock,
}));

function makeAccessContext(): OrgAccessContext {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    role: 'admin',
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
    consent: { requirement: null, latest: null },
    councilOfEurope: { requirement: null, acknowledgedVersion: null },
  };
}

authorizeRequestWithGuardsMock.mockResolvedValue(makeAccessContext());

const { app } = await import('../src/server.ts');

describe('Workspace compliance acknowledgements route', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    authorizeRequestWithGuardsMock.mockReset();
    authorizeRequestWithGuardsMock.mockResolvedValue(makeAccessContext());
  });

  it('rejects consent payloads with council acknowledgement type', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/compliance/acknowledgements',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
      payload: { consent: { type: 'council_of_europe_disclosure', version: '1.0.0' } },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_body' });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('rejects consent payloads with arbitrary acknowledgement types', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/compliance/acknowledgements',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
      payload: { consent: { type: 'custom_type', version: '1.0.0' } },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_body' });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('persists consent acknowledgements with the normalized consent type', async () => {
    const now = new Date().toISOString();
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'consent_events') {
        return createConsentQuery({
          data: [
            { consent_type: 'ai_assist', version: '1.0.0', created_at: now },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

    const response = await app.inject({
      method: 'POST',
      url: '/compliance/acknowledgements',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
      payload: { consent: { type: 'ai_assist', version: '2.0.0' } },
    });

    expect(response.statusCode).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'record_consent_events',
      expect.objectContaining({
        events: [
          expect.objectContaining({
            consent_type: 'ai_assist',
            version: '2.0.0',
            org_id: 'org-1',
            user_id: 'user-1',
          }),
        ],
      }),
    );
  });
});
