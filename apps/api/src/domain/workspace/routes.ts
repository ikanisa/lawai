import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../../types/context.js';

const workspaceQuerySchema = z.object({
  orgId: z.string().uuid(),
});

export async function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get<{ Querystring: z.infer<typeof workspaceQuerySchema> }>('/workspace', async (request, reply) => {
    const parse = workspaceQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Invalid query parameters' });
    }

    const { orgId } = parse.data;
    const { supabase } = ctx;

    // TODO: move existing implementation from server.ts here.
    const { data, error } = await supabase
      .from('agent_runs')
      .select('id')
      .eq('org_id', orgId)
      .limit(1);

    if (error) {
      request.log.error({ err: error }, 'workspace query failed');
      return reply.code(500).send({ error: 'workspace_failed' });
    }

    return { runs: data ?? [] };
  });
}
