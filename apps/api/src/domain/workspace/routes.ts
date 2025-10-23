import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../../types/context';
import { enforceRateLimit } from '../../rate-limit';

type WorkspaceQuery = z.infer<typeof workspaceQuerySchema>;
type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;

export async function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get<{ Querystring: z.infer<typeof workspaceQuerySchema> }>('/workspace', async (request, reply) => {
    if (ctx.rateLimits?.workspace) {
      await ctx.rateLimits.workspace(request, reply);
      if (reply.sent) {
        return;
      }
    }
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
