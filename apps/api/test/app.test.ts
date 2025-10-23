import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ServiceSupabaseClient } from '../src/types/supabase';

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: vi.fn() },
} as unknown as ServiceSupabaseClient;

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

describe('createApp', () => {
  let app: FastifyInstance;
  let contextSupabase: ServiceSupabaseClient;
  let originalSupabaseUrl: string | undefined;
  let originalSupabaseKey: string | undefined;

  beforeAll(async () => {
    originalSupabaseUrl = process.env.SUPABASE_URL;
    originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    process.env.SUPABASE_URL = originalSupabaseUrl ?? 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';

    const { createApp } = await import('../src/app.js');
    const created = await createApp();
    app = created.app;
    contextSupabase = created.context.supabase;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    if (originalSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalSupabaseKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey;
    }
  });

  it('registers core plugins with expected routes', () => {
    expect(app.hasRoute({ method: 'GET', url: '/workspace' })).toBe(true);
    expect(app.hasRoute({ method: 'POST', url: '/api/agents/run' })).toBe(true);
    expect(app.hasRoute({ method: 'GET', url: '/api/research/context' })).toBe(true);
  });

  it('exposes the shared Supabase context', () => {
    expect(contextSupabase).toBe(supabaseMock);
  });
});
