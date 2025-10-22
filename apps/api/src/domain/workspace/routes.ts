import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../../types/context';

const workspaceQuerySchema = z.object({
  orgId: z.string().uuid(),
});

export async function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext) {
  const guard = ctx.rateLimits.workspace ?? null;

  try {
    app.get<{ Querystring: z.infer<typeof workspaceQuerySchema> }>('/domain/workspace', async (request, reply) => {
      const parse = workspaceQuerySchema.safeParse(request.query);
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid query parameters' });
      }

      const { orgId } = parse.data;
      const userHeader = typeof request.headers['x-user-id'] === 'string' ? request.headers['x-user-id'] : 'anonymous';

      if (guard && (await guard(request, reply, ['domain', orgId, userHeader]))) {
        return;
      }

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
  } catch (error) {
    if ((error as { code?: string }).code !== 'FST_ERR_DUPLICATED_ROUTE') {
      throw error;
    }
    app.log.debug('workspace route already registered, skipping domain binding');
  }
}
