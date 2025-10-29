import { type RateLimiterFactory } from '../rate-limit.js';
import type { AppContext } from '../types/context.js';
interface WorkspacePluginOptions {
    context: AppContext;
    rateLimiterFactory: RateLimiterFactory;
}
export declare const workspacePlugin: import("fastify").FastifyPluginCallback<WorkspacePluginOptions, import("fastify").RawServerDefault, import("fastify").FastifyTypeProviderDefault, import("fastify").FastifyBaseLogger>;
export type WorkspacePlugin = typeof workspacePlugin;
export {};
//# sourceMappingURL=workspace.d.ts.map