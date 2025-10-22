import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../types/context.js';
import { getWorkspaceSchema, workspaceQuerySchema, type WorkspaceQuery } from './schemas.js';

export async function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get<{ Querystring: WorkspaceQuery }>(
    '/workspace',
    { schema: getWorkspaceSchema },
    async (request, reply) => {
      const { orgId } = workspaceQuerySchema.parse(request.query);
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
    },
  );
}
