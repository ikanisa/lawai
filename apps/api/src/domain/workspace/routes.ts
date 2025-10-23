import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { InMemoryRateLimiter } from '../../rate-limit.js';
import type { AppContext } from '../../types/context';
import { registerWorkspaceOverviewRoute } from './workspace-overview';
import { registerComplianceAcknowledgementsRoutes } from './compliance-acknowledgements';
import { registerComplianceStatusRoute } from './compliance-status';

function createRateLimitHook(
  limiter: InMemoryRateLimiter,
  bucket: string,
): (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> {
  return async (request, reply) => {
    const headerUser = request.headers['x-user-id'];
    const keyBase =
      typeof headerUser === 'string' && headerUser.trim().length > 0 ? headerUser.trim() : request.ip ?? 'anonymous';
    const hit = limiter.hit(`${bucket}:${keyBase}`);
    if (!hit.allowed) {
      reply.header('Retry-After', Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000)));
      return reply.code(429).send({ error: 'rate_limited' });
    }
    return undefined;
  };
}

export async function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext) {
  const workspaceLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 });
  const complianceLimiter = new InMemoryRateLimiter({ limit: 60, windowMs: 60_000 });

  const workspaceRateLimitHook = createRateLimitHook(workspaceLimiter, 'workspace');
  const complianceRateLimitHook = createRateLimitHook(complianceLimiter, 'compliance');

  registerWorkspaceOverviewRoute(app, ctx, workspaceRateLimitHook);
  registerComplianceAcknowledgementsRoutes(app, ctx, complianceRateLimitHook);
  registerComplianceStatusRoute(app, ctx, complianceRateLimitHook);
}
