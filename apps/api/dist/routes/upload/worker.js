const DEFAULT_WORKER_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_LIMIT = 10;
async function listPendingJobs(supabase, limit) {
    const { data, error } = await supabase
        .from('upload_ingestion_jobs')
        .select('id, org_id, document_id, status')
        .eq('status', 'pending')
        .order('queued_at', { ascending: true })
        .limit(limit);
    if (error) {
        throw new Error(error.message ?? 'upload_jobs_fetch_failed');
    }
    return Array.isArray(data) ? data : [];
}
async function markJob(supabase, jobId, patch) {
    const { error } = await supabase
        .from('upload_ingestion_jobs')
        .update(patch)
        .eq('id', jobId);
    if (error) {
        throw new Error(error.message ?? 'upload_job_update_failed');
    }
}
async function updateDocumentVectorStatus(supabase, orgId, documentId, status, syncedAt) {
    const { error } = await supabase
        .from('documents')
        .update({ vector_store_status: status, vector_store_synced_at: syncedAt })
        .eq('id', documentId)
        .eq('org_id', orgId);
    if (error) {
        throw new Error(error.message ?? 'document_vector_status_update_failed');
    }
}
export async function processUploadQueue(supabase, options = {}, logger) {
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'upload_job_failed';
            logger?.error?.({ err: message, jobId: job.id }, 'upload_job_failed');
            try {
                await markJob(supabase, job.id, {
                    status: 'failed',
                    error: message,
                    completed_at: new Date().toISOString(),
                });
            }
            catch (secondaryError) {
                logger?.error?.({ err: secondaryError instanceof Error ? secondaryError.message : secondaryError, jobId: job.id }, 'upload_job_failure_record_failed');
            }
        }
    }
    return processed;
}
export function registerUploadWorker(app, supabase, options = {}) {
    if (process.env.NODE_ENV === 'test') {
        return;
    }
    const intervalMs = options.intervalMs ?? DEFAULT_WORKER_INTERVAL_MS;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
        return;
    }
    let timer = null;
    app.addHook('onReady', async () => {
        if (timer) {
            return;
        }
        timer = setInterval(async () => {
            try {
                await processUploadQueue(supabase, { limit: options.limit }, app.log);
            }
            catch (error) {
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
