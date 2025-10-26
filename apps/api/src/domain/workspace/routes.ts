import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { authorizeRequestWithGuards } from '../../http/authorization.js';
import { buildPhaseCProcessNavigator } from '../../workspace.js';
import type { AppContext } from '../../types/context.js';
import { fetchWorkspaceOverview } from './services.js';

export async function registerWorkspaceRoutes(
  app: AppFastifyInstance,
  ctx: AppContext,
  services: Partial<WorkspaceServices> = {},
) {
  const { supabase } = ctx;
  const { fetchWorkspaceOverview, limiter } = { ...defaultServices, ...services };
  const guard = ctx.rateLimits.workspace;

  app.get<{ Querystring: WorkspaceQuery }>('/workspace', async (request, reply) => {
    const parsed = workspaceQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_query_parameters',
        message: 'Invalid query parameters',
        details: parsed.error.flatten(),
      });
    }

    const { orgId } = parse.data;
    const { supabase } = ctx;
    const userHeader = request.headers['x-user-id'];

    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    try {
      await authorizeRequestWithGuards('workspace:view', orgId, userHeader, request);

      const { data, errors } = await fetchWorkspaceOverview(supabase, orgId);

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

      return {
        ...data,
        navigator: buildPhaseCProcessNavigator(),
      };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number') {
        return reply.code((error as { statusCode: number }).statusCode).send({ error: error.message });
      }

      request.log.error({ err: error }, 'workspace overview failed');
      return reply.code(500).send({ error: 'workspace_failed' });
    }
  });
}
