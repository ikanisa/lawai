import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AppContext } from '../../types/context.js';
import { fetchCorpusDashboard } from './data.js';

const corpusQuerySchema = z
  .object({
    orgId: z.string().uuid(),
  })
  .strict();

export async function registerCorpusRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get('/corpus', async (request, reply) => {
    const queryParse = corpusQuerySchema.safeParse(request.query ?? {});
    if (!queryParse.success) {
      return reply.code(400).send({ error: 'invalid_request', details: queryParse.error.flatten() });
    }

    const userHeader = request.headers['x-user-id'];
    if (typeof userHeader !== 'string' || !userHeader.trim()) {
      return reply.code(400).send({ error: 'user_id_required' });
    }

    try {
      const dashboard = await fetchCorpusDashboard(ctx.supabase, queryParse.data.orgId);
      return dashboard;
    } catch (error) {
      request.log.error({ err: error }, 'corpus_dashboard_fetch_failed');
      return reply.code(500).send({ error: 'corpus_dashboard_fetch_failed' });
    }
  });
}
