import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../../types/context';
import { enforceRateLimit } from '../../rate-limit';

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
    const { supabase, rateLimiter } = ctx;

    const userHeader = request.headers['x-user-id'];
    const limiterKey = `${orgId}:${typeof userHeader === 'string' ? userHeader : request.ip ?? 'anonymous'}`;
    const allowed = await enforceRateLimit(rateLimiter.workspace, request, reply, limiterKey);
    if (!allowed) {
      return;
    }

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
