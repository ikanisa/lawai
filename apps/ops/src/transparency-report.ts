#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import ora from 'ora';
import { createRestClient, type RestApiClient } from '@avocat-ai/api-clients';
import { requireEnv } from './lib/env.js';

interface CliOptions {
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

async function generateReport(options: CliOptions, api: RestApiClient): Promise<unknown> {
  return api.generateTransparencyReport({
    orgId: options.orgId,
    userId: options.userId,
    periodStart: options.start,
    periodEnd: options.end,
    dryRun: options.dryRun,
  });
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

  const api = createRestClient({ baseUrl: options.apiBaseUrl });
  const spinner = ora('Génération du rapport de transparence...').start();
  try {
    const report = await generateReport(options, api);
    spinner.succeed('Rapport généré');
    writeOutput(report, options);
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

run();
