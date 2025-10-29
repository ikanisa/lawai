/// <reference types="node" />
import type { FastifyInstance } from 'fastify';
export interface GracefulShutdownOptions {
    signals?: NodeJS.Signals[];
    cleanup?: () => Promise<void> | void;
}
export declare function registerGracefulShutdown(app: FastifyInstance, options?: GracefulShutdownOptions): void;
//# sourceMappingURL=graceful-shutdown.d.ts.map