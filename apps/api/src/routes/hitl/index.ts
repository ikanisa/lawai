import { z } from 'zod';
import type { AppFastifyInstance } from '../../types/fastify.js';

import type { AppContext } from '../../types/context.js';
import { cloneHitlQueueData } from './data.js';

const hitlActionSchema = z.object({
  action: z.enum(['approve', 'request_changes', 'reject']).default('approve'),
});

export async function registerHitlRoutes(app: AppFastifyInstance, _ctx: AppContext) {
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
