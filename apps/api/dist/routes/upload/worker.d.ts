import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
export interface UploadQueueOptions {
    limit?: number;
}
export declare function processUploadQueue(supabase: SupabaseClient, options?: UploadQueueOptions, logger?: FastifyBaseLogger): Promise<number>;
export interface UploadWorkerOptions extends UploadQueueOptions {
    intervalMs?: number;
}
export declare function registerUploadWorker(app: FastifyInstance, supabase: SupabaseClient, options?: UploadWorkerOptions): void;
//# sourceMappingURL=worker.d.ts.map