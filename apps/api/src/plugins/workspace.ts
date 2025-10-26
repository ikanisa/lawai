import fp from 'fastify-plugin';
import { rateLimitConfig } from '../config.js';
import { createRateLimitGuard, type RateLimiterFactory } from '../rate-limit.js';
import type { AppContext } from '../types/context.js';

interface WorkspacePluginOptions {
  context: AppContext;
  rateLimiterFactory: RateLimiterFactory;
}

export const workspacePlugin = fp<WorkspacePluginOptions>(async (app, options) => {
  const { context, rateLimiterFactory } = options;

  const workspaceLimiter = rateLimiterFactory.create('workspace', rateLimitConfig.buckets.workspace);
  const workspaceGuard = createRateLimitGuard(workspaceLimiter, {
    name: 'workspace',
    errorResponse: () => ({ error: 'rate_limited', scope: 'workspace' }),
  });
  context.limiters.workspace = workspaceLimiter;
  context.rateLimits.workspace = workspaceGuard;
});

export type WorkspacePlugin = typeof workspacePlugin;
