#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import ora from 'ora';
import { requireEnv } from './lib/env.js';
import { createSupabaseService } from './lib/supabase.js';
import { recordOpsAuditEvent } from './lib/audit.js';

export interface CliOptions {
  orgId: string;
  userId: string;
  apiBaseUrl: string;
  start?: string;
  end?: string;
  dryRun: boolean;
  output?: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    orgId: process.env.TRANSPARENCY_ORG_ID ?? '00000000-0000-0000-0000-000000000000',
    userId: process.env.TRANSPARENCY_USER_ID ?? '00000000-0000-0000-0000-000000000000',
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
    dryRun: false,
    output: undefined,
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
      case '--start':
        options.start = args[index + 1];
        index += 1;
        break;
      case '--end':
        options.end = args[index + 1];
        index += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--output':
        options.output = args[index + 1];
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

interface TransparencyReportResponse {
  report?: {
    id: string;
    org_id: string;
    period_start: string;
    period_end: string;
    generated_at: string;
    distribution_status?: string | null;
    metrics?: Record<string, unknown>;
    cepej_summary?: Record<string, unknown> | null;
  };
  dryRun?: boolean;
}

export async function generateReport(options: CliOptions): Promise<TransparencyReportResponse> {
  const payload = {
    orgId: options.orgId,
    periodStart: options.start,
    periodEnd: options.end,
    dryRun: options.dryRun,
  };

  const response = await fetch(`${options.apiBaseUrl}/reports/transparency`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': options.userId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Echec génération rapport (${response.status}): ${body}`);
  }

  return (await response.json()) as TransparencyReportResponse;
}

function writeOutput(report: unknown, options: CliOptions): void {
  if (!options.output) {
    console.dir(report, { depth: 4 });
    return;
  }
  const target = path.resolve(process.cwd(), options.output);
  fs.writeFileSync(target, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Rapport enregistré dans ${target}`);
}

async function run(): Promise<void> {
  const options = parseArgs();
  if (!options.dryRun) {
    requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  }

  const supabase = options.dryRun ? null : createSupabaseService(process.env as Record<string, string>);
  const spinner = ora('Génération du rapport de transparence...').start();
  try {
    const report = await generateReport(options);
    spinner.succeed('Rapport généré');
    writeOutput(report, options);
    if (!options.dryRun && supabase && report?.report) {
      await recordOpsAuditEvent(supabase, {
        orgId: options.orgId,
        actorId: options.userId,
        kind: 'report.transparency.generated',
        object: `transparency:${report.report.id}`,
        metadata: {
          period_start: report.report.period_start,
          period_end: report.report.period_end,
          distribution_status: report.report.distribution_status ?? 'unknown',
        },
      });
    }
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  run();
}
