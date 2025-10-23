import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../../types/context.js';
import { cloneHitlQueueData } from './data.js';

const hitlActionSchema = z.object({
  action: z.enum(['approve', 'request_changes', 'reject', 'acknowledged']).default('acknowledged'),
});

export async function registerHitlRoutes(app: FastifyInstance, _ctx: AppContext) {
  app.get('/hitl', async () => cloneHitlQueueData());

  app.post<{ Params: { id: string } }>('/hitl/:id', async (request, reply) => {
    const parsed = hitlActionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    return {
      id: request.params.id,
      action: parsed.data.action,
      processedAt: new Date().toISOString(),
    };
  });
}
