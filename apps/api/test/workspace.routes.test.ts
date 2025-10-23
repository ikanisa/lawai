import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { registerWorkspaceRoutes } from '../src/domain/workspace/routes.js';
import type { AppContext } from '../src/types/context.js';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createQueryBuilder(result: QueryResult) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.limit = vi.fn(async () => result);
  return builder;
}

async function setupApp(result: QueryResult) {
  const app = Fastify({
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });
  const supabase = { from: vi.fn() };
  const context: AppContext = {
    supabase: supabase as unknown as AppContext['supabase'],
    config: {
      openai: {
        apiKey: 'test-key',
      },
    },
    container: {} as AppContext['container'],
  };

  const queryBuilder = createQueryBuilder(result);
  supabase.from.mockReturnValue(queryBuilder);

  await registerWorkspaceRoutes(app, context);
  await app.ready();

  return { app, supabase, queryBuilder };
}

describe('workspace routes', () => {
  const orgId = '550e8400-e29b-41d4-a716-446655440000';

  it('returns the recent workspace runs', async () => {
    const { app, supabase, queryBuilder } = await setupApp({ data: [{ id: 'run-1' }], error: null });

    const response = await app.inject({ method: 'GET', url: `/workspace?orgId=${orgId}` });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ runs: [{ id: 'run-1' }] });
    expect(supabase.from).toHaveBeenCalledWith('agent_runs');
    expect(queryBuilder.select).toHaveBeenCalledWith('id');
    expect(queryBuilder.eq).toHaveBeenCalledWith('org_id', orgId);
    expect(queryBuilder.limit).toHaveBeenCalledWith(1);

    await app.close();
  });

  it('returns an error when the query fails', async () => {
    const { app } = await setupApp({ data: null, error: { message: 'boom' } });

    const response = await app.inject({ method: 'GET', url: `/workspace?orgId=${orgId}` });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'workspace_failed' });

    await app.close();
  });

  it('rejects requests with unknown query parameters', async () => {
    const { app, supabase } = await setupApp({ data: null, error: null });

    const response = await app.inject({ method: 'GET', url: `/workspace?orgId=${orgId}&unexpected=value` });

    expect(response.statusCode).toBe(400);
    const errorBody = JSON.parse(response.body);
    expect(errorBody).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    expect(errorBody.message).toMatch(/additional properties/);
    expect(supabase.from).not.toHaveBeenCalled();

    await app.close();
  });
});
