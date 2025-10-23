import type { SupabaseClient } from '@supabase/supabase-js';
import { formatISO, subDays } from 'date-fns';
import { generateTransparencyReport } from './transparency.js';
import { listSloSnapshots } from './slo.js';
import { enqueueRegulatorDigest } from './regulator.js';
import { createOpsAuditLogger } from '../supabase.js';

export interface ScheduledReportsOptions {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  apiBaseUrl: string;
  timezone?: string;
}

export interface ScheduledReportResult {
  kind: 'transparency' | 'slo' | 'regulator';
  status: 'completed' | 'failed';
  payload: unknown | null;
  insertedId: string | null;
  error?: string;
  metadata?: Record<string, unknown>;
}

async function storeReport(
  supabase: SupabaseClient,
  kind: ScheduledReportResult['kind'],
  orgId: string,
  userId: string,
  payload: unknown,
  metadata: Record<string, unknown> | undefined,
  status: ScheduledReportResult['status'],
): Promise<string | null> {
  const { data, error } = await supabase
    .from('ops_report_runs')
    .insert({
      org_id: orgId,
      report_kind: kind,
      requested_by: userId,
      payload,
      metadata: metadata ?? null,
      status,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`ops_report_store_failed:${error.message}`);
  }

  return data?.id ?? null;
}

export async function runScheduledReports(options: ScheduledReportsOptions): Promise<ScheduledReportResult[]> {
  const auditLogger = createOpsAuditLogger(options.supabase);
  const now = new Date();
  const periodStart = formatISO(subDays(now, 7));
  const periodEnd = formatISO(now);

  const results: ScheduledReportResult[] = [];

  async function processReport<T>(
    kind: ScheduledReportResult['kind'],
    run: () => Promise<T>,
    metadata: Record<string, unknown>,
    successEvent: string,
    failureEvent: string,
  ): Promise<void> {
    try {
      const payload = await run();
      const insertedId = await storeReport(options.supabase, kind, options.orgId, options.userId, payload, metadata, 'completed');
      await auditLogger.log({
        orgId: options.orgId,
        actorId: options.userId,
        kind: successEvent,
        object: insertedId ?? `${kind}-report`,
        metadata,
      });
      results.push({ kind, status: 'completed', payload, insertedId, metadata });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failurePayload = { error: message, metadata };
      await auditLogger.log({
        orgId: options.orgId,
        actorId: options.userId,
        kind: failureEvent,
        object: `${kind}-report`,
        metadata: { ...metadata, error: message },
      });
      await storeReport(options.supabase, kind, options.orgId, options.userId, failurePayload, metadata, 'failed').catch(() => {
        // Swallow persistence errors here because the primary failure has already been reported via audit.
      });
      results.push({ kind, status: 'failed', payload: null, insertedId: null, error: message, metadata });
    }
  }

  await processReport(
    'transparency',
    () =>
      generateTransparencyReport({
        orgId: options.orgId,
        userId: options.userId,
        apiBaseUrl: options.apiBaseUrl,
        periodStart,
        periodEnd,
        dryRun: false,
      }),
    { periodStart, periodEnd },
    'report.transparency.generated',
    'report.transparency.failed',
  );

  await processReport(
    'slo',
    () =>
      listSloSnapshots({
        orgId: options.orgId,
        userId: options.userId,
        apiBaseUrl: options.apiBaseUrl,
        limit: 1,
      }),
    { fetchedAt: now.toISOString() },
    'report.slo.collected',
    'report.slo.failed',
  );

  await processReport(
    'regulator',
    () =>
      enqueueRegulatorDigest({
        orgId: options.orgId,
        userId: options.userId,
        apiBaseUrl: options.apiBaseUrl,
        periodStart,
        periodEnd,
      }),
    { periodStart, periodEnd },
    'report.regulator.enqueued',
    'report.regulator.failed',
  );

  return results;
}
