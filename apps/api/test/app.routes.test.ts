import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-role-key';

import type { AppFastifyInstance } from '../src/types/fastify.js';

describe('createApp route registration', () => {
  let app: AppFastifyInstance;

  beforeAll(async () => {
    const { createApp } = await import('../src/app.js');
    const created = await createApp();
    app = created.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers prefixed API routes', () => {
    const apiRoutes: Array<{ method: string; url: string }> = [
      { method: 'POST', url: '/api/agents/run' },
      { method: 'POST', url: '/api/agents/stream' },
      { method: 'GET', url: '/api/research/context' },
      { method: 'GET', url: '/api/citations' },
      { method: 'GET', url: '/api/corpus' },
      { method: 'GET', url: '/api/matters' },
      { method: 'GET', url: '/api/hitl' },
      { method: 'POST', url: '/api/hitl/:id' },
      { method: 'POST', url: '/api/deadline' },
      { method: 'POST', url: '/api/upload' },
      { method: 'GET', url: '/api/voice/context' },
      { method: 'POST', url: '/api/voice/run' },
      { method: 'POST', url: '/api/realtime/session' },
    ];

    for (const route of apiRoutes) {
      expect(app.hasRoute(route)).toBe(true);
    }

    expect(app.hasRoute({ method: 'GET', url: '/workspace' })).toBe(true);
  });
});
