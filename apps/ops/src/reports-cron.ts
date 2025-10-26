#!/usr/bin/env node
import type { SupabaseClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import ora from 'ora';
import { requireEnv } from './lib/env.js';
import { createSupabaseService } from './lib/supabase.js';
import { runScheduledReports, type ScheduledReportFeatureFlags } from './lib/reports/scheduler.js';
import { buildReportFeatureFlags, hasEnabledReports } from './lib/reports/config.js';

async function executeScheduledReports(
  context: {
    supabase: SupabaseClient;
    orgId: string;
    userId: string;
    apiBaseUrl: string;
  },
  flags: ScheduledReportFeatureFlags,
): Promise<void> {
  const spinner = ora('Exécution du cycle de rapports planifiés...').start();

  try {
    const results = await runScheduledReports(
      {
        supabase: context.supabase,
        orgId: context.orgId,
        userId: context.userId,
        apiBaseUrl: context.apiBaseUrl,
      },
      flags,
    );

    const hasFailure = results.some((report) => report.status === 'failed');
    const hasSuccess = results.some((report) => report.status === 'completed');
    const allSkipped = results.length > 0 && results.every((report) => report.status === 'skipped');

    if (hasFailure) {
      spinner.warn('Cycle terminé avec erreurs. Consultez les détails ci-dessous.');
    } else if (hasSuccess) {
      spinner.succeed('Rapports générés et archivés.');
    } else if (allSkipped) {
      spinner.info('Aucune tâche exécutée — toutes les tâches sont désactivées.');
    } else {
      spinner.succeed('Cycle de planification terminé.');
    }

    for (const report of results) {
      let prefix = 'ℹ️';
      let target = report.insertedId ?? 'not stored';
      let detail = '';

      if (report.status === 'completed') {
        prefix = '✅';
      } else if (report.status === 'failed') {
        prefix = '⚠️';
        detail = report.error ? ` – ${report.error}` : '';
      } else if (report.status === 'skipped') {
        prefix = '⏭️';
        target = 'skipped';
        const reason = typeof report.metadata?.reason === 'string' ? report.metadata.reason : 'Ignoré par configuration';
        detail = ` – ${reason}`;
      }

      console.log(`${prefix} ${report.kind} → ${target}${detail}`);
    }

    if (hasFailure) {
      process.exitCode = 1;
    }
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function main(): void {
  const supabaseConfig = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  const supabase = createSupabaseService(supabaseConfig);
  const orgId =
    process.env.DISPATCH_ORG_ID ?? process.env.TRANSPARENCY_ORG_ID ?? '00000000-0000-0000-0000-000000000000';
  const userId =
    process.env.DISPATCH_USER_ID ?? process.env.TRANSPARENCY_USER_ID ?? '00000000-0000-0000-0000-000000000000';
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';

  const schedule = process.env.OPS_REPORTS_CRON ?? '0 6 * * *';
  const timezone = process.env.OPS_REPORTS_TZ ?? 'UTC';
  const runOnce = process.argv.includes('--once');

  const flags = buildReportFeatureFlags(process.env);

  if (!hasEnabledReports(flags)) {
    console.warn('[reports-cron] toutes les tâches sont désactivées. Aucun rapport ne sera planifié.');
  }

  const context = { supabase, orgId, userId, apiBaseUrl };

  let running = false;
  const trigger = async () => {
    if (running) {
      console.warn('[reports-cron] un cycle est déjà en cours, déclenchement ignoré.');
      return;
    }
    running = true;
    try {
      await executeScheduledReports(context, buildReportFeatureFlags(process.env));
    } finally {
      running = false;
    }
  };

  if (runOnce) {
    void trigger();
    return;
  }

  console.log(`[reports-cron] Planification activée (${schedule} @ ${timezone}).`);
  const task = cron.schedule(schedule, () => {
    void trigger();
  }, { timezone });

  task.start();
}

main();
