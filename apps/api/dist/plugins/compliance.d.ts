import { type RateLimiterFactory } from '../rate-limit.js';
import type { AppContext } from '../types/context.js';
interface CompliancePluginOptions {
    context: AppContext;
    rateLimiterFactory: RateLimiterFactory;
}
export declare const compliancePlugin: import("fastify").FastifyPluginCallback<CompliancePluginOptions, import("fastify").RawServerDefault, import("fastify").FastifyTypeProviderDefault, import("fastify").FastifyBaseLogger>;
export type CompliancePlugin = typeof compliancePlugin;
export {};
//# sourceMappingURL=compliance.d.ts.map