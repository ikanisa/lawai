import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateCompliance } from '../src/compliance.ts';
import { registerComplianceRoutes } from '../src/domain/compliance/routes.ts';
import { SupabaseRateLimiter, createRateLimitPreHandler } from '../src/rate-limit.ts';

vi.mock('../src/http/authorization.js', () => ({
  authorizeRequestWithGuards: vi.fn(async (_action: string, orgId: string, userId: string) => ({
    orgId,
    userId,
    role: 'admin',
    consent: { requirement: null, latest: null },
    councilOfEurope: { requirement: null, acknowledgedVersion: null },
    policies: { confidentialMode: false, residencyZones: [], residencyZone: null },
  })),
}));

const basePayload = {
  jurisdiction: { country: 'FR', eu: true, ohada: false },
  issue: 'Question juridique',
  rules: [
    {
      citation: 'Code civil, art. 1240',
      source_url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417902/',
      binding: true,
      effective_date: '2016-10-01',
    },
  ],
  application: 'Analyse structurée',
  conclusion: 'Conclusion factuelle',
  citations: [
    {
      title: 'Code civil',
      court_or_publisher: 'Légifrance',
      date: '2016-10-01',
      url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417902/',
      note: 'consolidé',
    },
  ],
  risk: {
    level: 'LOW' as const,
    why: 'Analyse standard',
    hitl_required: false,
  },
};

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

const consentEvents: Array<{ consent_type: string; version: string; created_at: string; org_id: string; user_id: string }> = [];
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
};

function createQueryBuilder(factory: () => { data: unknown; error: unknown }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    insert: vi.fn(() => Promise.resolve(factory())),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(factory()),
    maybeSingle: vi.fn(() => Promise.resolve(factory())),
    single: vi.fn(() => Promise.resolve(factory())),
  };
  return builder;
}

let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  consentEvents.length = 0;
  rateLimitBuckets.clear();
  supabaseMock.from.mockReset();
  supabaseMock.rpc.mockReset();

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'consent_events') {
      return createQueryBuilder(() => ({ data: [...consentEvents], error: null }));
    }
    if (table === 'compliance_assessments') {
      return createQueryBuilder(() => ({ data: [], error: null }));
    }
    return createQueryBuilder(() => ({ data: null, error: null }));
  });

  supabaseMock.rpc.mockImplementation(async (fn: string, params: Record<string, unknown>) => {
    if (fn === 'rate_limit_hit') {
      const identifier = String(params.identifier ?? '');
      const limit = Number(params.limit ?? 0);
      const windowSeconds = Number(params.window_seconds ?? 0);
      const now = Date.now();
      const existing = rateLimitBuckets.get(identifier);
      if (!existing || existing.resetAt <= now) {
        const resetAt = now + windowSeconds * 1000;
        rateLimitBuckets.set(identifier, { count: 1, resetAt });
        return { data: { allowed: true, remaining: Math.max(0, limit - 1), reset_at: new Date(resetAt).toISOString() }, error: null };
      }
      existing.count += 1;
      const allowed = existing.count <= limit;
      const remaining = allowed ? Math.max(0, limit - existing.count) : 0;
      return {
        data: { allowed, remaining, reset_at: new Date(existing.resetAt).toISOString() },
        error: null,
      };
    }

    if (fn === 'record_consent_events') {
      const events = Array.isArray(params?.events) ? (params.events as Array<Record<string, string>>) : [];
      const nowIso = new Date().toISOString();
      for (const event of events) {
        consentEvents.unshift({
          consent_type: event.consent_type ?? '',
          version: event.version ?? '',
          created_at: nowIso,
          org_id: event.org_id ?? '',
          user_id: event.user_id ?? '',
        });
      }
      return { data: null, error: null };
    }

    return { data: null, error: null };
  });

  app = Fastify();
  const ctx = {
    supabase: supabaseMock as any,
    config: { openai: { apiKey: '' } },
  };

  const limiter = new SupabaseRateLimiter({ supabase: supabaseMock as any, limit: 2, windowSeconds: 60, prefix: 'test' });
  const routeRateLimit = createRateLimitPreHandler({
    limiter,
    keyGenerator: (request) => {
      const orgId = request.headers['x-org-id'];
      const userId = request.headers['x-user-id'];
      if (typeof orgId === 'string' && typeof userId === 'string') {
        return `${orgId}:${userId}`;
      }
      return null;
    },
  });

  await registerComplianceRoutes(app, ctx, {
    rateLimiters: { acknowledgements: routeRateLimit, status: routeRateLimit },
  });
});

afterEach(async () => {
  await app.close();
});

describe('evaluateCompliance', () => {
  it('flags EU AI Act FRIA requirements when litigation keywords are present', () => {
    const assessment = evaluateCompliance({
      question:
        "Prépare une requête introductive d'instance devant le tribunal judiciaire de Paris pour contester une sanction.",
      payload: basePayload,
      primaryJurisdiction: { country: 'FR', eu: true, ohada: false },
    });

    expect(assessment.fria.required).toBe(true);
    expect(assessment.fria.reasons.length).toBeGreaterThan(0);
  });

  it('detects CEPEJ transparency violations when citations are missing', () => {
    const assessment = evaluateCompliance({
      question: 'Analyse disciplinaire sans source',
      payload: { ...basePayload, citations: [], rules: [] },
      primaryJurisdiction: { country: 'FR', eu: true, ohada: false },
    });

    expect(assessment.cepej.passed).toBe(false);
    expect(assessment.cepej.violations).toEqual(expect.arrayContaining(['transparency', 'quality_security']));
  });
});

describe('compliance routes', () => {
  const headers = { 'x-user-id': USER_ID, 'x-org-id': ORG_ID };

  it('returns acknowledgements and records new consent events', async () => {
    consentEvents.push({
      consent_type: 'ai_assist',
      version: '1.0',
      created_at: new Date().toISOString(),
      org_id: ORG_ID,
      user_id: USER_ID,
    });

    const initial = await app.inject({ method: 'GET', url: '/compliance/acknowledgements', headers });
    expect(initial.statusCode).toBe(200);
    const initialBody = initial.json() as { acknowledgements: { consent: { acknowledgedVersion: string | null } } };
    expect(initialBody.acknowledgements.consent.acknowledgedVersion).toBe('1.0');

    const response = await app.inject({
      method: 'POST',
      url: '/compliance/acknowledgements',
      headers,
      payload: { consent: { type: 'ai_assist', version: '2.0' } },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { acknowledgements: { consent: { acknowledgedVersion: string | null } } };
    expect(body.acknowledgements.consent.acknowledgedVersion).toBe('2.0');
    expect(consentEvents[0]?.version).toBe('2.0');
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'record_consent_events',
      expect.objectContaining({ events: expect.any(Array) }),
    );
  });

  it('enforces rate limiting on acknowledgements', async () => {
    const payload = { consent: { type: 'ai_assist', version: '3.0' } };

    const first = await app.inject({ method: 'POST', url: '/compliance/acknowledgements', headers, payload });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: 'POST', url: '/compliance/acknowledgements', headers, payload });
    expect(second.statusCode).toBe(200);

    const third = await app.inject({ method: 'POST', url: '/compliance/acknowledgements', headers, payload });
    expect(third.statusCode).toBe(429);
    expect(third.headers['retry-after']).toBeDefined();
  });
});
