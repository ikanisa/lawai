import Fastify, { type FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/http/authorization.js', () => ({
  authorizeRequestWithGuards: vi.fn(async () => ({})),
}));

import { registerWorkspaceRoutes } from '../src/domain/workspace/routes.js';
import type { AppContext } from '../src/types/context.js';
import {
  fetchWorkspaceOverview as realFetchWorkspaceOverview,
  type WorkspaceOverview,
} from '../src/domain/workspace/services.js';
import { buildPhaseCWorkspaceDesk } from '../src/workspace.js';

const baseOverview: WorkspaceOverview = {
  jurisdictions: [],
  matters: [],
  complianceWatch: [],
  hitlInbox: { items: [], pendingCount: 0 },
  desk: buildPhaseCWorkspaceDesk(),
};

const supabaseStub = {} as SupabaseClient;

const createContext = (): AppContext => ({
  supabase: supabaseStub,
  config: { openai: { apiKey: 'test-key' } },
  rateLimits: {},
});

describe('workspace routes', () => {
  let app: FastifyInstance;
  let fetchWorkspaceOverview: vi.MockedFunction<typeof realFetchWorkspaceOverview>;

  beforeEach(async () => {
    app = Fastify();
    fetchWorkspaceOverview = vi.fn<typeof realFetchWorkspaceOverview>();
    await registerWorkspaceRoutes(app, createContext(), { fetchWorkspaceOverview });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects missing orgId with 400', async () => {
    const response = await app.inject({ method: 'GET', url: '/workspace' });
    expect(response.statusCode).toBe(400);
    expect(fetchWorkspaceOverview).not.toHaveBeenCalled();
  });

  it('returns workspace overview when the service succeeds', async () => {
    fetchWorkspaceOverview.mockResolvedValue({ data: baseOverview, errors: {} });

    const response = await app.inject({
      method: 'GET',
      url: '/workspace?orgId=00000000-0000-0000-0000-000000000000',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.meta.status).toBe('ok');
    expect(payload.meta.warnings).toEqual([]);
    expect(payload.data).toEqual(baseOverview);
  });

  it('returns 206 with warnings when some sections fail', async () => {
    fetchWorkspaceOverview.mockResolvedValue({
      data: baseOverview,
      errors: {
        matters: { message: 'Matters fetch failed', code: '123' },
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/workspace?orgId=00000000-0000-0000-0000-000000000000',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(206);
    const payload = response.json();
    expect(payload.meta.status).toBe('partial');
    expect(payload.meta.warnings).toHaveLength(1);
    expect(payload.meta.errors.matters).toMatchObject({ message: 'Matters fetch failed', code: '123' });
  });

  it('returns 502 when all sections fail', async () => {
    fetchWorkspaceOverview.mockResolvedValue({
      data: baseOverview,
      errors: {
        matters: { message: 'Matters fetch failed' },
        jurisdictions: { message: 'Jurisdictions fetch failed' },
        compliance: { message: 'Compliance fetch failed' },
        hitl: { message: 'HITL fetch failed' },
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/workspace?orgId=00000000-0000-0000-0000-000000000000',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(502);
    const payload = response.json();
    expect(payload.meta.status).toBe('error');
    expect(payload.meta.warnings).toHaveLength(4);
  });

  it('returns 500 when the service throws an error', async () => {
    fetchWorkspaceOverview.mockRejectedValue(new Error('boom'));

    const response = await app.inject({
      method: 'GET',
      url: '/workspace?orgId=00000000-0000-0000-0000-000000000000',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(500);
    const payload = response.json();
    expect(payload.error).toBe('workspace_fetch_failed');
    expect(payload.message).toContain('boom');
  });
});

