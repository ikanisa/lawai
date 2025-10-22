import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../types/context.js';
import { workspaceQuerySchema } from './schemas.js';
import type { WorkspaceQuery } from './schemas.js';

export async function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext) {
  const workspaceController = ctx.container.workspace;

  app.get<{ Querystring: WorkspaceQuery }>('/workspace', async (request, reply) => {
    const parse = workspaceQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Invalid query parameters' });
    }

    const { orgId } = parse.data;
    try {
      const snapshot = await workspaceController.getWorkspace(orgId);
      return snapshot;
    } catch (error) {
      request.log.error({ err: error, orgId }, 'workspace_query_failed');
      return reply.code(500).send({ error: 'workspace_failed' });
    }
  });
}
