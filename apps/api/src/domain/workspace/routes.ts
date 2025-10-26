import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { authorizeRequestWithGuards } from '../../http/authorization.js';
import type { AppFastifyInstance } from '../../types/fastify.js';
import type { AppContext } from '../../types/context.js';
import { fetchWorkspaceOverview as defaultFetchWorkspaceOverview } from './services.js';
import type { WorkspaceFetchErrors } from './overview.js';

type WorkspaceServices = {
  fetchWorkspaceOverview: typeof defaultFetchWorkspaceOverview;
};

const workspaceQuerySchema = z.object({
  orgId: z.string().uuid('orgId must be a valid UUID'),
});

type WorkspaceQuery = z.infer<typeof workspaceQuerySchema>;

const workspaceHeadersSchema = z.object({
  'x-user-id': z.string().min(1, 'x-user-id header is required'),
});

type WorkspaceHeaders = z.infer<typeof workspaceHeadersSchema>;

const WORKSPACE_SECTIONS = ['jurisdictions', 'matters', 'compliance', 'hitl'] as const;

const SECTION_LABELS: Record<(typeof WORKSPACE_SECTIONS)[number], string> = {
  jurisdictions: 'jurisdictions',
  matters: 'matters',
  compliance: 'compliance watch',
  hitl: 'HITL inbox',
};

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

  app.get<{ Querystring: WorkspaceQuery; Headers: WorkspaceHeaders }>('/workspace', async (request, reply) => {
    const parsed = workspaceQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_query_parameters',
        message: 'Invalid query parameters',
        details: parsed.error.flatten(),
      });
    }

    const parsedHeaders = workspaceHeadersSchema.safeParse(request.headers);
    if (!parsedHeaders.success) {
      return reply.code(400).send({
        error: 'invalid_headers',
        message: 'Invalid headers',
        details: parsedHeaders.error.flatten(),
      });
    }

    const userId = parsedHeaders.data['x-user-id'];

    if (workspaceGuard) {
      const allowed = await workspaceGuard(request, reply, ['workspace', parsed.data.orgId]);
      if (!allowed) {
        return;
      }
    }

    try {
      await authorizeRequestWithGuards('workspace:view', parsed.data.orgId, userId, request);
    } catch (error) {
      if (
        error instanceof Error &&
        'statusCode' in error &&
        typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ) {
        return reply.code((error as { statusCode: number }).statusCode).send({ error: error.message });
      }

      request.log.error({ err: error }, 'workspace_overview_authorization_failed');
      return reply.code(403).send({ error: 'forbidden' });
    }

    try {
      const { data, errors } = await services.fetchWorkspaceOverview(supabase, parsed.data.orgId);

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
