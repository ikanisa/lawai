import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_WORKER_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_LIMIT = 10;

interface UploadJobRecord {
  id: string;
  org_id: string;
  document_id: string;
  status: string;
}

async function listPendingJobs(
  supabase: SupabaseClient,
  limit: number,
): Promise<UploadJobRecord[]> {
  const { data, error } = await supabase
    .from('upload_ingestion_jobs')
    .select('id, org_id, document_id, status')
    .eq('status', 'pending')
    .order('queued_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message ?? 'upload_jobs_fetch_failed');
  }

  return Array.isArray(data) ? (data as UploadJobRecord[]) : [];
}

async function markJob(
  supabase: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('upload_ingestion_jobs')
    .update(patch)
    .eq('id', jobId);

  if (error) {
    throw new Error(error.message ?? 'upload_job_update_failed');
  }
}

async function updateDocumentVectorStatus(
  supabase: SupabaseClient,
  orgId: string,
  documentId: string,
  status: 'pending' | 'uploaded' | 'failed',
  syncedAt: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ vector_store_status: status, vector_store_synced_at: syncedAt })
    .eq('id', documentId)
    .eq('org_id', orgId);

  if (error) {
    throw new Error(error.message ?? 'document_vector_status_update_failed');
  }
}

export interface UploadQueueOptions {
  limit?: number;
}

export async function processUploadQueue(
  supabase: SupabaseClient,
  options: UploadQueueOptions = {},
  logger?: FastifyBaseLogger,
): Promise<number> {
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_BATCH_LIMIT, DEFAULT_BATCH_LIMIT));
  const jobs = await listPendingJobs(supabase, limit);

  if (jobs.length === 0) {
    return 0;
  }

  let processed = 0;

  for (const job of jobs) {
    const startedAt = new Date().toISOString();
    try {
      await markJob(supabase, job.id, {
        status: 'processing',
        started_at: startedAt,
        progress: 10,
        error: null,
      });

      await updateDocumentVectorStatus(supabase, job.org_id, job.document_id, 'uploaded', startedAt);

      await markJob(supabase, job.id, {
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
      });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'upload_job_failed';
      logger?.error?.({ err: message, jobId: job.id }, 'upload_job_failed');

      try {
        await markJob(supabase, job.id, {
          status: 'failed',
          error: message,
          completed_at: new Date().toISOString(),
        });
      } catch (secondaryError) {
        logger?.error?.(
          { err: secondaryError instanceof Error ? secondaryError.message : secondaryError, jobId: job.id },
          'upload_job_failure_record_failed',
        );
      }
    }
  }

  return processed;
}

export interface UploadWorkerOptions extends UploadQueueOptions {
  intervalMs?: number;
}

export function registerUploadWorker(
  app: FastifyInstance,
  supabase: SupabaseClient,
  options: UploadWorkerOptions = {},
): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const intervalMs = options.intervalMs ?? DEFAULT_WORKER_INTERVAL_MS;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return;
  }

  let timer: NodeJS.Timeout | null = null;

  app.addHook('onReady', async () => {
    if (timer) {
      return;
    }

    timer = setInterval(async () => {
      try {
        await processUploadQueue(supabase, { limit: options.limit }, app.log);
      } catch (error) {
        app.log.error({ err: error instanceof Error ? error.message : error }, 'upload_worker_iteration_failed');
      }
    }, intervalMs).unref();
  });

  app.addHook('onClose', async () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });
}
