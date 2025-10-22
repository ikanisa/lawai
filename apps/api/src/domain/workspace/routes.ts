import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../../types/context.js';
import { getWorkspaceOverview } from './overview.js';

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

    const { overview, errors } = await getWorkspaceOverview(supabase, orgId);

    if (errors.jurisdictions) {
      request.log.error({ err: errors.jurisdictions }, 'workspace jurisdictions query failed');
    }
    if (errors.matters) {
      request.log.error({ err: errors.matters }, 'workspace matters query failed');
    }
    if (errors.compliance) {
      request.log.error({ err: errors.compliance }, 'workspace compliance query failed');
    }
    if (errors.hitl) {
      request.log.error({ err: errors.hitl }, 'workspace hitl query failed');
    }

    return overview;
  });
}
