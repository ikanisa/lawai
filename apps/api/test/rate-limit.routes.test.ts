import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { createRateLimiterFactory, enforceRateLimit } from '../src/rate-limit';

describe('rate limit guards', () => {
  it('returns 429 when /runs limit is exceeded', async () => {
    const factory = createRateLimiterFactory({ driver: 'memory' });
    const limiter = factory({ limit: 1, windowMs: 60_000 });
    const app = Fastify();

    app.post('/runs', async (request, reply) => {
      const allowed = await enforceRateLimit(limiter, request, reply, 'runs:test-user');
      if (!allowed) {
        return;
      }
      return reply.send({ ok: true });
    });

    const first = await app.inject({ method: 'POST', url: '/runs' });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: 'POST', url: '/runs' });
    expect(second.statusCode).toBe(429);

    await app.close();
  });

  it('returns 429 when compliance acknowledgements limit is exceeded', async () => {
    const factory = createRateLimiterFactory({ driver: 'memory' });
    const limiter = factory({ limit: 1, windowMs: 60_000 });
    const app = Fastify();

    app.get('/compliance/acknowledgements', async (request, reply) => {
      const allowed = await enforceRateLimit(limiter, request, reply, 'compliance:org:user');
      if (!allowed) {
        return;
      }
      return reply.send({ ok: true });
    });

    const headers = { 'x-user-id': 'user', 'x-org-id': 'org' };

    const first = await app.inject({ method: 'GET', url: '/compliance/acknowledgements', headers });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: 'GET', url: '/compliance/acknowledgements', headers });
    expect(second.statusCode).toBe(429);

    await app.close();
  });
});
