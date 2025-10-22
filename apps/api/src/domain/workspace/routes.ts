import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../../types/context.js';
import { authorizeRequestWithGuards } from '../../http/authorization.js';
import { buildPhaseCProcessNavigator } from '../../workspace.js';
import { fetchWorkspaceOverview } from './services.js';

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
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    const { supabase } = ctx;

    try {
      await authorizeRequestWithGuards('workspace:view', orgId, userHeader, request);
      const { data, errors } = await fetchWorkspaceOverview(supabase, orgId);

      if (errors.jurisdictions) {
        request.log.error(
          { err: errors.jurisdictions, orgId },
          'workspace_jurisdictions_query_failed',
        );
      }
      if (errors.matters) {
        request.log.error({ err: errors.matters, orgId }, 'workspace_matters_query_failed');
      }
      if (errors.compliance) {
        request.log.error({ err: errors.compliance, orgId }, 'workspace_compliance_query_failed');
      }
      if (errors.hitl) {
        request.log.error({ err: errors.hitl, orgId }, 'workspace_hitl_query_failed');
      }

      return {
        jurisdictions: data.jurisdictions,
        matters: data.matters,
        complianceWatch: data.complianceWatch,
        hitlInbox: data.hitlInbox,
        desk: data.desk,
        navigator: buildPhaseCProcessNavigator(),
      };
    } catch (error) {
      request.log.error({ err: error, orgId }, 'workspace_overview_failed');
      return reply.code(500).send({ error: 'workspace_failed' });
    }
  });
}
