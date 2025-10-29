import type { SupabaseClient } from '@supabase/supabase-js';
import { type FinanceCommandResult, type FinanceDomainKey, type FinanceWorkerEnvelope } from '@avocat-ai/shared';
import type { OrchestratorLogger } from './orchestrator.js';
export interface WorkerExecuteContext {
    supabase: SupabaseClient;
    envelope: FinanceWorkerEnvelope;
    logger?: OrchestratorLogger;
}
export interface DomainWorker {
    domain: FinanceDomainKey;
    execute: (context: WorkerExecuteContext) => Promise<FinanceCommandResult>;
}
export interface WorkerRegistry {
    get(domain: FinanceDomainKey): DomainWorker | null;
    register(worker: DomainWorker): void;
    clear(): void;
}
export declare const workerRegistry: WorkerRegistry;
export declare function resetWorkerRegistry(): void;
export interface WorkerClaimOptions {
    orgId: string;
    worker: 'director' | 'domain';
    limit?: number;
}
export declare function claimFinanceJobs(supabase: SupabaseClient, options: WorkerClaimOptions): Promise<FinanceWorkerEnvelope[]>;
export declare function processFinanceJob(supabase: SupabaseClient, envelope: FinanceWorkerEnvelope, result: FinanceCommandResult): Promise<void>;
export declare function runFinanceWorker(supabase: SupabaseClient, envelope: FinanceWorkerEnvelope, logger?: OrchestratorLogger): Promise<FinanceCommandResult>;
export declare function processFinanceQueue(supabase: SupabaseClient, options: WorkerClaimOptions, logger?: OrchestratorLogger): Promise<number>;
//# sourceMappingURL=worker.d.ts.map