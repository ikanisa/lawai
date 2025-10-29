import fp from 'fastify-plugin';
import { rateLimitConfig } from '../config.js';
import { createRateLimitGuard } from '../rate-limit.js';
export const workspacePlugin = fp(async (app, options) => {
    const { context, rateLimiterFactory } = options;
    const workspaceLimiter = rateLimiterFactory.create('workspace', rateLimitConfig.buckets.workspace);
    const workspaceGuard = createRateLimitGuard(workspaceLimiter, {
        name: 'workspace',
        errorResponse: () => ({ error: 'rate_limited', scope: 'workspace' }),
    });
    context.limiters.workspace = workspaceLimiter;
    context.rateLimits.workspace = workspaceGuard;
});
