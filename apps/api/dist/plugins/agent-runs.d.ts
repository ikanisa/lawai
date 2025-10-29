import { type RateLimiterFactory } from '../rate-limit.js';
import type { AppContext } from '../types/context.js';
interface AgentRunsPluginOptions {
    context: AppContext;
    rateLimiterFactory: RateLimiterFactory;
}
export declare const agentRunsPlugin: import("fastify").FastifyPluginCallback<AgentRunsPluginOptions, import("fastify").RawServerDefault, import("fastify").FastifyTypeProviderDefault, import("fastify").FastifyBaseLogger>;
export type AgentRunsPlugin = typeof agentRunsPlugin;
export {};
//# sourceMappingURL=agent-runs.d.ts.map