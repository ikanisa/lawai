#!/usr/bin/env node
import ora from 'ora';
import { requireEnv } from './lib/env.js';
import { createSupabaseService } from './lib/supabase.js';
import { recordOpsAuditEvent } from './lib/audit.js';
import {
  generateReport as generateTransparencyReport,
  type CliOptions as TransparencyOptions,
} from './transparency-report.js';
import { createSnapshot as createSloSnapshot, type CliOptions as SloOptions } from './slo-report.js';
import {
  fetchDispatches,
  formatRegulatorDigest,
  resolvePeriodRange,
  createDispatchRecord,
  type CliOptions as DispatchOptions,
} from './regulator-digest.js';

interface SchedulerConfig {
  orgId: string;
  userId: string;
  apiBaseUrl: string;
}

function resolveConfig(): SchedulerConfig {
  const orgId =
    process.env.REPORTS_ORG_ID ??
    process.env.TRANSPARENCY_ORG_ID ??
    '00000000-0000-0000-0000-000000000000';
  const userId =
    process.env.REPORTS_USER_ID ??
    process.env.TRANSPARENCY_USER_ID ??
    '00000000-0000-0000-0000-000000000000';
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
  return { orgId, userId, apiBaseUrl };
}

function parseNumber(name: string, fallback: number | null): number | null {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function run(): Promise<void> {
  requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  const config = resolveConfig();
  const supabase = createSupabaseService(process.env as Record<string, string>);

  const transparencySpinner = ora('Génération automatique du rapport de transparence').start();
  try {
    const transparencyOptions: TransparencyOptions = {
      orgId: config.orgId,
      userId: config.userId,
      apiBaseUrl: config.apiBaseUrl,
      start: process.env.SCHEDULE_TRANSPARENCY_START,
      end: process.env.SCHEDULE_TRANSPARENCY_END,
      dryRun: false,
      output: undefined,
    };
    const report = await generateTransparencyReport(transparencyOptions);
    transparencySpinner.succeed('Rapport de transparence enregistré');
    if (report.report) {
      await recordOpsAuditEvent(supabase, {
        orgId: config.orgId,
        actorId: config.userId,
        kind: 'schedule.transparency.completed',
        object: `transparency:${report.report.id}`,
        metadata: {
          period_start: report.report.period_start,
          period_end: report.report.period_end,
          distribution_status: report.report.distribution_status ?? 'unknown',
        },
      });
    }
  } catch (error) {
    transparencySpinner.fail(error instanceof Error ? error.message : String(error));
    throw error;
  }

  const sloSpinner = ora('Capture d’un snapshot SLO').start();
  try {
    const sloOptions: SloOptions = {
      orgId: config.orgId,
      userId: config.userId,
      apiBaseUrl: config.apiBaseUrl,
      apiUptime: parseNumber('SCHEDULE_SLO_API_UPTIME', null),
      hitlP95: parseNumber('SCHEDULE_SLO_HITL_P95', null),
      retrievalP95: parseNumber('SCHEDULE_SLO_RETRIEVAL_P95', null),
      citationP95: parseNumber('SCHEDULE_SLO_CITATION_P95', null),
      notes: process.env.SCHEDULE_SLO_NOTES,
      exportCsv: false,
      listOnly: false,
    };

    if (
      sloOptions.apiUptime === null ||
      sloOptions.hitlP95 === null ||
      sloOptions.retrievalP95 === null
    ) {
      sloSpinner.warn('Variables SLO manquantes, snapshot ignoré');
    } else {
      const snapshot = await createSloSnapshot(sloOptions);
      sloSpinner.succeed('Snapshot SLO enregistré');
      await recordOpsAuditEvent(supabase, {
        orgId: config.orgId,
        actorId: config.userId,
        kind: 'schedule.slo.completed',
        object: `slo:${snapshot.id}`,
        metadata: {
          captured_at: snapshot.captured_at,
          api_uptime_percent: snapshot.api_uptime_percent,
          hitl_response_p95_seconds: snapshot.hitl_response_p95_seconds,
          retrieval_latency_p95_seconds: snapshot.retrieval_latency_p95_seconds,
        },
      });
    }
  } catch (error) {
    sloSpinner.fail(error instanceof Error ? error.message : String(error));
    throw error;
  }

  const digestSpinner = ora('Compilation du digest régulateur').start();
  try {
    const dispatchOptions: DispatchOptions = {
      orgId: config.orgId,
      userId: config.userId,
      apiBaseUrl: config.apiBaseUrl,
      verifyParity: true,
      output: 'markdown',
      record: true,
    };
    const dispatches = await fetchDispatches(dispatchOptions);
    const digestMarkdown = formatRegulatorDigest(new Date(), dispatches);
    const periodOptions: DispatchOptions = {
      ...dispatchOptions,
      periodStart: process.env.SCHEDULE_DISPATCH_START,
      periodEnd: process.env.SCHEDULE_DISPATCH_END,
    };
    const period = resolvePeriodRange(periodOptions);
    const recorded = await createDispatchRecord(periodOptions, period, digestMarkdown, null);
    digestSpinner.succeed('Digest régulateur enregistré');
    await recordOpsAuditEvent(supabase, {
      orgId: config.orgId,
      actorId: config.userId,
      kind: 'schedule.regulator_digest.completed',
      object: `dispatch:${recorded.id}`,
      metadata: {
        period_start: recorded.period_start,
        period_end: recorded.period_end,
        status: recorded.status ?? 'unknown',
      },
    });
  } catch (error) {
    digestSpinner.fail(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

if (import.meta.main) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
