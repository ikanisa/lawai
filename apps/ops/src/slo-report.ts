#!/usr/bin/env node
import ora from 'ora';
import { requireEnv } from './lib/env.js';

interface CliOptions {
  orgId: string;
  userId: string;
  apiBaseUrl: string;
  apiUptime: number | null;
  hitlP95: number | null;
  retrievalP95: number | null;
  citationP95: number | null;
  notes?: string;
  exportCsv: boolean;
  listOnly: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    orgId: process.env.SLO_ORG_ID ?? process.env.TRANSPARENCY_ORG_ID ?? '00000000-0000-0000-0000-000000000000',
    userId: process.env.SLO_USER_ID ?? process.env.TRANSPARENCY_USER_ID ?? '00000000-0000-0000-0000-000000000000',
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
    apiUptime: null,
    hitlP95: null,
    retrievalP95: null,
    citationP95: null,
    notes: undefined,
    exportCsv: false,
    listOnly: false,
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
      case '--uptime':
        options.apiUptime = Number.parseFloat(args[index + 1] ?? 'NaN');
        index += 1;
        break;
      case '--hitl-p95':
        options.hitlP95 = Number.parseFloat(args[index + 1] ?? 'NaN');
        index += 1;
        break;
      case '--retrieval-p95':
        options.retrievalP95 = Number.parseFloat(args[index + 1] ?? 'NaN');
        index += 1;
        break;
      case '--citation-p95':
        options.citationP95 = Number.parseFloat(args[index + 1] ?? 'NaN');
        index += 1;
        break;
      case '--notes':
        options.notes = args[index + 1];
        index += 1;
        break;
      case '--export':
        options.exportCsv = true;
        break;
      case '--list':
        options.listOnly = true;
        break;
      default:
        break;
    }
  }

  return options;
}

async function listSnapshots(options: CliOptions): Promise<unknown> {
  const basePath = options.exportCsv ? '/metrics/slo/export' : '/metrics/slo';
  const params = new URLSearchParams({ orgId: options.orgId });
  if (options.exportCsv) {
    params.set('format', 'csv');
  }
  const response = await fetch(`${options.apiBaseUrl}${basePath}?${params.toString()}`, {
    headers: {
      'x-user-id': options.userId,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Impossible de récupérer les SLO (${response.status}): ${body}`);
  }

  return options.exportCsv ? response.text() : response.json();
}

async function createSnapshot(options: CliOptions): Promise<unknown> {
  const payload = {
    orgId: options.orgId,
    apiUptimePercent: options.apiUptime,
    hitlResponseP95Seconds: options.hitlP95,
    retrievalLatencyP95Seconds: options.retrievalP95,
    citationPrecisionP95: options.citationP95,
    notes: options.notes,
  };

  const response = await fetch(`${options.apiBaseUrl}/metrics/slo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': options.userId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Echec enregistrement SLO (${response.status}): ${body}`);
  }

  return response.json();
}

async function run(): Promise<void> {
  const options = parseArgs();
  requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

  if (!options.listOnly && (options.apiUptime === null || options.hitlP95 === null || options.retrievalP95 === null)) {
    console.error('Les indicateurs --uptime, --hitl-p95 et --retrieval-p95 sont requis pour créer un snapshot.');
    process.exitCode = 1;
    return;
  }

  const spinner = ora(options.listOnly ? 'Récupération des SLO...' : 'Enregistrement du snapshot SLO...').start();
  try {
    const result = options.listOnly ? await listSnapshots(options) : await createSnapshot(options);
    spinner.succeed(options.listOnly ? 'SLO récupérés' : 'Snapshot SLO enregistré');
    if (typeof result === 'string') {
      console.log(result);
    } else {
      console.dir(result, { depth: 4 });
    }
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

run();
