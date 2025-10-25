#!/usr/bin/env node
import ora from 'ora';
import { requireEnv } from './lib/env.js';
import { createSupabaseService } from './lib/supabase.js';
import { runScheduledReports } from './lib/reports/scheduler.js';

interface CliOptions {
  orgId: string;
  userId: string;
  apiBaseUrl: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    orgId: process.env.DISPATCH_ORG_ID ?? process.env.TRANSPARENCY_ORG_ID ?? '00000000-0000-0000-0000-000000000000',
    userId: process.env.DISPATCH_USER_ID ?? process.env.TRANSPARENCY_USER_ID ?? '00000000-0000-0000-0000-000000000000',
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--org':
        options.orgId = args[index + 1] ?? options.orgId;
        index += 1;
        break;
      case '--user':
        options.userId = args[index + 1] ?? options.userId;
        index += 1;
        break;
      case '--api':
        options.apiBaseUrl = args[index + 1] ?? options.apiBaseUrl;
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

async function run(): Promise<void> {
  requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  const options = parseArgs();
  const spinner = ora('Planification des rapports de conformité...').start();

  try {
    const supabase = createSupabaseService(process.env as Record<string, string>);
    const results = await runScheduledReports(
      {
        supabase,
        orgId: options.orgId,
        userId: options.userId,
        apiBaseUrl: options.apiBaseUrl,
      },
      {},
    );
    const hasFailure = results.some((report) => report.status === 'failed');
    const hasSuccess = results.some((report) => report.status === 'completed');
    const allSkipped = results.length > 0 && results.every((report) => report.status === 'skipped');

    if (hasFailure) {
      spinner.warn('Rapports générés avec avertissements. Consultez les erreurs ci-dessous.');
    } else if (hasSuccess) {
      spinner.succeed('Rapports générés et archivés.');
    } else if (allSkipped) {
      spinner.info('Aucun rapport généré — toutes les tâches sont désactivées.');
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

run();
