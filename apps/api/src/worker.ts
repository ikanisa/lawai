// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  financeCommandPayloadSchema,
  financeCommandResultSchema,
  type FinanceCommandPayload,
  type FinanceCommandResult,
  type FinanceDomainKey,
  type FinanceWorkerEnvelope,
} from '@avocat-ai/shared';
import { listPendingJobs, updateCommandStatus, updateJobStatus } from './orchestrator.js';
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

class InMemoryWorkerRegistry implements WorkerRegistry {
  private readonly map = new Map<FinanceDomainKey, DomainWorker>();

  register(worker: DomainWorker): void {
    this.map.set(worker.domain, worker);
  }

  get(domain: FinanceDomainKey): DomainWorker | null {
    return this.map.get(domain) ?? null;
  }

  clear(): void {
    this.map.clear();
  }
}

export const workerRegistry: WorkerRegistry = new InMemoryWorkerRegistry();

export function resetWorkerRegistry(): void {
  workerRegistry.clear();
}

export interface WorkerClaimOptions {
  orgId: string;
  worker: 'director' | 'domain';
  limit?: number;
}

export async function claimFinanceJobs(
  supabase: SupabaseClient,
  options: WorkerClaimOptions,
): Promise<FinanceWorkerEnvelope[]> {
  const jobs = await listPendingJobs(supabase, options.orgId, options.worker, options.limit ?? 5);
  const financeEnvelopes: FinanceWorkerEnvelope[] = [];

  for (const envelope of jobs) {
    const validation = financeCommandPayloadSchema.safeParse(envelope.command.payload);
    if (!validation.success) {
      continue;
    }

    financeEnvelopes.push({
      ...envelope,
      command: {
        ...envelope.command,
        payload: validation.data,
      },
    });
  }

  return financeEnvelopes;
}

export async function processFinanceJob(
  supabase: SupabaseClient,
  envelope: FinanceWorkerEnvelope,
  result: FinanceCommandResult,
): Promise<void> {
  const now = new Date().toISOString();
  const status =
    result.status ?? (result.hitlReason ? 'needs_hitl' : 'completed');

  if (status === 'completed') {
    await updateJobStatus(supabase, envelope.job.id, 'completed', {
      completedAt: now,
    });
    await updateCommandStatus(supabase, envelope.command.id, 'completed', {
      completedAt: now,
      result,
      lastError: null,
    });
    return;
  }

  if (status === 'failed') {
    const reason = result.errorCode ?? 'finance_job_failed';
    await updateJobStatus(supabase, envelope.job.id, 'failed', {
      failedAt: now,
      lastError: reason,
    });
    await updateCommandStatus(supabase, envelope.command.id, 'failed', {
      failedAt: now,
      lastError: reason,
      result,
    });
    return;
  }

  await updateJobStatus(supabase, envelope.job.id, 'cancelled', {
    failedAt: now,
    lastError: result.hitlReason ?? 'requires_hitl',
  });
  await updateCommandStatus(supabase, envelope.command.id, 'cancelled', {
    failedAt: now,
    lastError: result.hitlReason ?? 'requires_hitl',
    result,
  });
}

export async function runFinanceWorker(
  supabase: SupabaseClient,
  envelope: FinanceWorkerEnvelope,
  logger?: OrchestratorLogger,
): Promise<FinanceCommandResult> {
  const payloadValidation = financeCommandPayloadSchema.safeParse(envelope.command.payload);
  if (!payloadValidation.success) {
    const reason = 'invalid_finance_payload';
    await updateJobStatus(supabase, envelope.job.id, 'failed', {
      failedAt: new Date().toISOString(),
      lastError: reason,
    });
    await updateCommandStatus(supabase, envelope.command.id, 'failed', {
      failedAt: new Date().toISOString(),
      lastError: reason,
    });
    throw new Error(reason);
  }

  const payload = payloadValidation.data;
  const worker = workerRegistry.get(payload.domain);

  if (!worker) {
    const reason = `worker_not_registered:${payload.domain}`;
    await updateJobStatus(supabase, envelope.job.id, 'failed', {
      failedAt: new Date().toISOString(),
      lastError: reason,
    });
    await updateCommandStatus(supabase, envelope.command.id, 'failed', {
      failedAt: new Date().toISOString(),
      lastError: reason,
    });
    throw new Error(reason);
  }

  try {
    const result = await worker.execute({ supabase, envelope: { ...envelope, command: { ...envelope.command, payload } }, logger });
    const validated = financeCommandResultSchema.safeParse(result ?? {});
    if (!validated.success) {
      const reason = 'invalid_finance_result';
      logger?.error?.({ issues: validated.error.flatten(), jobId: envelope.job.id }, reason);
      await processFinanceJob(supabase, envelope, {
        status: 'failed',
        errorCode: reason,
      });
      throw new Error(reason);
    }
    const finalResult: FinanceCommandResult = {
      status: validated.data.status ?? 'completed',
      output: validated.data.output ?? {},
      notices: validated.data.notices ?? [],
      followUps: validated.data.followUps ?? [],
      telemetry: validated.data.telemetry,
      errorCode: validated.data.errorCode,
      hitlReason: validated.data.hitlReason,
    };
    await processFinanceJob(supabase, envelope, finalResult);
    return finalResult;
  } catch (error) {
    logger?.error?.({ err: error instanceof Error ? error.message : error, jobId: envelope.job.id }, 'finance_worker_execute_failed');
    await processFinanceJob(supabase, envelope, {
      status: 'failed',
      errorCode: error instanceof Error ? error.message : 'worker_failed',
    });
    throw error instanceof Error ? error : new Error('worker_failed');
  }
}

export async function processFinanceQueue(
  supabase: SupabaseClient,
  options: WorkerClaimOptions,
  logger?: OrchestratorLogger,
): Promise<number> {
  const envelopes = await claimFinanceJobs(supabase, options);
  if (envelopes.length === 0) {
    return 0;
  }

  let processed = 0;
  for (const envelope of envelopes) {
    try {
      await runFinanceWorker(supabase, envelope, logger);
      processed += 1;
    } catch (error) {
      logger?.error?.({ err: error instanceof Error ? error.message : error, jobId: envelope.job.id }, 'finance_queue_item_failed');
    }
  }

  return processed;
}
