#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ora from 'ora';
import { format } from 'date-fns';
import { requireEnv } from './lib/env.js';

interface CliOptions {
  orgId: string;
  userId: string;
  apiBaseUrl: string;
  periodStart?: string;
  periodEnd?: string;
  output: 'markdown' | 'json';
  verifyParity: boolean;
}

interface DispatchRecord {
  id: string;
  report_type: string | null;
  period_start: string;
  period_end: string;
  status: string | null;
  payload_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  dispatched_at: string | null;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    orgId: process.env.DISPATCH_ORG_ID ?? '00000000-0000-0000-0000-000000000000',
    userId: process.env.DISPATCH_USER_ID ?? '00000000-0000-0000-0000-000000000000',
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
    output: 'markdown',
    verifyParity: true,
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
        options.periodStart = args[index + 1];
        index += 1;
        break;
      case '--end':
        options.periodEnd = args[index + 1];
        index += 1;
        break;
      case '--json':
        options.output = 'json';
        break;
      case '--no-parity':
        options.verifyParity = false;
        break;
      default:
        break;
    }
  }

  return options;
}

interface LaunchDigestEntry {
  id: string;
  orgId: string;
  requestedBy: string;
  jurisdiction: string;
  channel: string;
  frequency: string;
  recipients: string[];
  topics?: string[];
  createdAt: string;
}

export function formatRegulatorDigest(reference: Date, dispatches: DispatchRecord[]): string {
  const header = `# Bulletin régulateur (${format(reference, 'yyyy-MM-dd')})`;
  if (dispatches.length === 0) {
    return `${header}\n\n_Aucune notification envoyée durant la période demandée._`;
  }

  const lines: string[] = [header, ''];
  for (const dispatch of dispatches) {
    const period = `${dispatch.period_start} → ${dispatch.period_end}`;
    const status = (dispatch.status ?? 'en préparation').toLowerCase();
    const url = dispatch.payload_url ? ` [Dossier](${dispatch.payload_url})` : '';
    const regulator = dispatch.metadata?.regulator ?? 'Regulateur non spécifié';
    lines.push(`- ${period} · ${dispatch.report_type ?? 'rapport'} · ${regulator} · ${status}${url}`);
  }
  return `${lines.join('\n')}\n`;
}

function buildRequestHeaders(options: CliOptions) {
  return {
    'x-user-id': options.userId,
    'x-org-id': options.orgId,
  };
}

async function fetchLaunchDigests(options: CliOptions): Promise<LaunchDigestEntry[]> {
  const params = new URLSearchParams({ orgId: options.orgId, limit: '25' });
  const response = await fetch(`${options.apiBaseUrl}/launch/digests?${params.toString()}`, {
    headers: buildRequestHeaders(options),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Impossible de récupérer la file des digests (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { digests?: LaunchDigestEntry[] };
  return json.digests ?? [];
}

export function summariseParity(dispatches: DispatchRecord[], digests: LaunchDigestEntry[]) {
  const dispatchIds = new Set(dispatches.map((record) => record.id));
  const unmatched = digests.filter((digest) => !dispatchIds.has(digest.id));
  return {
    queued: digests.length,
    dispatched: dispatches.length,
    delta: digests.length - dispatches.length,
    unmatched,
    inSync: unmatched.length === 0 && dispatches.length === digests.length,
  };
}

async function fetchDispatches(options: CliOptions): Promise<DispatchRecord[]> {
  const params = new URLSearchParams({ orgId: options.orgId });
  if (options.periodStart) {
    params.set('periodStart', options.periodStart);
  }
  if (options.periodEnd) {
    params.set('periodEnd', options.periodEnd);
  }

  const response = await fetch(`${options.apiBaseUrl}/reports/dispatches?${params.toString()}`, {
    headers: { ...buildRequestHeaders(options) },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Impossible de récupérer les notifications (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { dispatches?: DispatchRecord[] };
  return json.dispatches ?? [];
}

async function run(): Promise<void> {
  const options = parseArgs();
  requireEnv(['SUPABASE_URL']);
  const spinner = ora('Compilation du digest régulateur...').start();
  try {
    const [dispatches, digests] = await Promise.all([
      fetchDispatches(options),
      options.verifyParity ? fetchLaunchDigests(options) : Promise.resolve<LaunchDigestEntry[]>([]),
    ]);
    const parity = options.verifyParity ? summariseParity(dispatches, digests) : null;
    spinner.succeed('Digest généré');
    if (options.output === 'json') {
      console.log(JSON.stringify({ dispatches, digests, parity }, null, 2));
      return;
    }
    console.log(formatRegulatorDigest(new Date(), dispatches));
    if (parity) {
      console.log(
        `> Parité file d'attente : ${parity.queued} en file / ${parity.dispatched} expédiés (Δ ${parity.delta >= 0 ? '+' : ''}${parity.delta}).`,
      );
      if (!parity.inSync) {
        console.warn(
          `> ${parity.unmatched.length} digest(s) restent à dispatcher : ${parity.unmatched
            .map((entry) => `${entry.channel}:${entry.frequency}@${entry.jurisdiction}`)
            .join(', ') || 'non identifié'}.`,
        );
      }
    }
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

const isMain = typeof process !== 'undefined' && process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isMain) {
  run();
}
