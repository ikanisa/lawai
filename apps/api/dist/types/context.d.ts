import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppContainer } from '../core/container.js';
import type { RateLimiter, RateLimiterFactory } from '../rate-limit.js';
import type { SupabaseServiceClient } from './supabase.js';
export type RateLimitGuard = (request: FastifyRequest, reply: FastifyReply, keyParts?: unknown[]) => Promise<boolean> | boolean;
export interface AppContext {
    supabase: SupabaseServiceClient;
    container: AppContainer;
    config: {
        openai: {
            apiKey: string;
            baseUrl?: string;
        };
    };
    rateLimiterFactory: RateLimiterFactory;
    rateLimits: {
        workspace?: RateLimitGuard;
        runs?: RateLimitGuard;
        compliance?: RateLimitGuard;
    };
    limiters: {
        workspace?: RateLimiter;
        runs?: RateLimiter;
        compliance?: RateLimiter;
    };
}
//# sourceMappingURL=context.d.ts.map