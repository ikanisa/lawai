import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { AppContext } from '../../types/context';
import { fetchWorkspaceOverview } from './index';

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

    try {
      const supabase = ctx.supabase as unknown as SupabaseClient;
      const { data, errors } = await fetchWorkspaceOverview(supabase, orgId);

      if (errors.jurisdictions) {
        request.log.error({ err: errors.jurisdictions, orgId }, 'workspace jurisdictions query failed');
      }
      if (errors.matters) {
        request.log.error({ err: errors.matters, orgId }, 'workspace matters query failed');
      }
      if (errors.compliance) {
        request.log.error({ err: errors.compliance, orgId }, 'workspace compliance query failed');
      }
      if (errors.hitl) {
        request.log.error({ err: errors.hitl, orgId }, 'workspace hitl query failed');
      }

      return data;
    } catch (error) {
      request.log.error({ err: error, orgId }, 'workspace overview failed');
      return reply.code(500).send({ error: 'workspace_failed' });
    }
  });
}
