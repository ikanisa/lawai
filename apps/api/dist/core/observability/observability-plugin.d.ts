import type { FastifyInstance } from 'fastify';
declare module 'fastify' {
    interface FastifyRequest {
        observability?: {
            traceId: string;
            startedAt: bigint;
        };
    }
}
export declare const observabilityPlugin: (app: FastifyInstance) => Promise<void>;
//# sourceMappingURL=observability-plugin.d.ts.map