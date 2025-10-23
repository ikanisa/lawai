import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';

process.env.NODE_ENV = 'test';

type SupabaseQueryResult = { data: unknown; error: unknown };

function createSupabaseStub(result: SupabaseQueryResult) {
  const queryBuilder = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    limit: vi.fn(async () => result),
  };

  return {
    from: vi.fn(() => queryBuilder),
  };
}

describe('workspace routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unexpected query parameters', async () => {
    const supabase = createSupabaseStub({ data: [], error: null });
    const { app } = await createApp({ supabase: supabase as any, includeWorkspaceDomainRoutes: true });

    const response = await app.inject({
      method: 'GET',
      url: '/workspace?orgId=00000000-0000-0000-0000-000000000001&extra=value',
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('accepts a valid request and queries supabase', async () => {
    const supabase = createSupabaseStub({ data: [{ id: 'run-1' }], error: null });
    const { app } = await createApp({ supabase: supabase as any, includeWorkspaceDomainRoutes: true });

    const response = await app.inject({
      method: 'GET',
      url: '/workspace?orgId=00000000-0000-0000-0000-000000000001',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ runs: [{ id: 'run-1' }] });
    expect(supabase.from).toHaveBeenCalledWith('agent_runs');
    await app.close();
  });
});
