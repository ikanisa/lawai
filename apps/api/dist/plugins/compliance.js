import fp from 'fastify-plugin';
import { rateLimitConfig } from '../config.js';
import { createRateLimitGuard, createRateLimitPreHandler, SupabaseRateLimiter, } from '../rate-limit.js';
import { registerComplianceRoutes } from '../domain/compliance/routes.js';
export const compliancePlugin = fp(async (app, options) => {
    const { context, rateLimiterFactory } = options;
    const complianceLimiter = rateLimiterFactory.create('compliance', rateLimitConfig.buckets.compliance);
    context.limiters.compliance = complianceLimiter;
    context.rateLimits.compliance = createRateLimitGuard(complianceLimiter, {
        name: 'compliance',
        errorResponse: () => ({ error: 'rate_limited', scope: 'compliance' }),
    });
    const sensitiveLimiter = new SupabaseRateLimiter({
        supabase: context.supabase,
        limit: 30,
        windowSeconds: 60,
        prefix: 'sensitive',
    });
    const acknowledgementsLimiter = createRateLimitPreHandler({
        limiter: sensitiveLimiter,
        keyGenerator: (request) => {
            const userHeader = request.headers['x-user-id'];
            const orgHeader = request.headers['x-org-id'];
            if (typeof userHeader === 'string' && typeof orgHeader === 'string') {
                return `${orgHeader}:${userHeader}:compliance`;
            }
            return null;
        },
        errorResponse: () => ({ error: 'rate_limited', scope: 'compliance' }),
    });
    const statusLimiter = createRateLimitPreHandler({
        limiter: sensitiveLimiter,
        keyGenerator: (request) => {
            const userHeader = request.headers['x-user-id'];
            const orgHeader = request.headers['x-org-id'];
            if (typeof userHeader === 'string' && typeof orgHeader === 'string') {
                return `${orgHeader}:${userHeader}:compliance-status`;
            }
            return null;
        },
        errorResponse: () => ({ error: 'rate_limited', scope: 'compliance' }),
    });
    await registerComplianceRoutes(app, context, {
        rateLimiters: {
            acknowledgements: acknowledgementsLimiter,
            status: statusLimiter,
        },
    });
});
