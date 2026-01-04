#!/usr/bin/env node
import ora from 'ora';
import { requireEnv } from './lib/env.js';
import { createSupabaseService } from './lib/supabase.js';

interface CliOptions {
  orgId: string;
  userId: string;
  apiBaseUrl: string;
  windowLabel: string;
  notes?: string;
  dryRun: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    orgId: process.env.PERF_ORG_ID ?? '00000000-0000-0000-0000-000000000000',
    userId: process.env.PERF_USER_ID ?? '00000000-0000-0000-0000-000000000000',
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
    windowLabel: process.env.PERF_WINDOW ?? 'rolling-30d',
    dryRun: false,
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
      case '--window':
        options.windowLabel = args[index + 1] ?? options.windowLabel;
        index += 1;
        break;
      case '--notes':
        options.notes = args[index + 1];
        index += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        break;
    }
  }

  return options;
}

async function fetchMetrics(options: CliOptions) {
  const response = await fetch(`${options.apiBaseUrl}/metrics/governance?orgId=${options.orgId}`, {
    headers: {
      'x-user-id': options.userId,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Echec récupération métriques (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    overview: {
      orgId: string;
      totalRuns: number;
      runsLast30Days: number;
      highRiskRuns: number;
      confidentialRuns: number;
      avgLatencyMs: number;
      allowlistedCitationRatio: number | null;
      hitlPending: number;
      hitlMedianResponseMinutes: number | null;
      evaluationCases: number;
      evaluationPassRate: number | null;
    } | null;
    tools: Array<{
      toolName: string;
      totalInvocations: number;
      successCount: number;
      failureCount: number;
      avgLatencyMs: number;
      p95LatencyMs: number | null;
      lastInvokedAt: string | null;
    }>;
  };

  return json;
}

async function recordSnapshot(
  supabaseUrl: string,
  serviceRoleKey: string,
  options: CliOptions,
  metrics: Awaited<ReturnType<typeof fetchMetrics>>,
): Promise<void> {
  const client = createSupabaseService({
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  });

  const overview = metrics.overview;
  const p95 = metrics.tools.length > 0
    ? Math.max(...metrics.tools.map((tool) => tool.p95LatencyMs ?? 0))
    : null;

  const payload = {
    org_id: options.orgId,
    window_label: options.windowLabel,
    total_runs: overview?.totalRuns ?? 0,
    avg_latency_ms: overview?.avgLatencyMs ?? null,
    p95_latency_ms: p95,
    allowlisted_ratio: overview?.allowlistedCitationRatio ?? null,
    hitl_median_minutes: overview?.hitlMedianResponseMinutes ?? null,
    citation_precision: overview?.allowlistedCitationRatio ?? null,
    temporal_validity: overview?.evaluationPassRate ?? null,
    binding_warnings: null,
    notes: options.notes ?? null,
    recorded_by: options.userId,
    metadata: { tools: metrics.tools },
  };

  const { error } = await client.from('performance_snapshots').insert(payload);
  if (error) {
    throw new Error(`Impossible d'enregistrer le snapshot de performance: ${error.message}`);
  }
}

async function run(): Promise<void> {
  const options = parseArgs();
  const spinner = ora('Collecte des métriques de performance...').start();

  try {
    const metrics = await fetchMetrics(options);
    spinner.info('Métriques récupérées');

    if (!options.dryRun) {
      const env = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
      await recordSnapshot(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options, metrics);
      spinner.succeed('Snapshot de performance enregistré');
    } else {
      spinner.stop();
      console.log('Mode dry-run : aucun enregistrement réalisé.');
    }

    if (metrics.overview) {
      console.table({
        org: metrics.overview.orgId,
        totalRuns: metrics.overview.totalRuns,
        avgLatencyMs: metrics.overview.avgLatencyMs,
        allowlistedRatio: metrics.overview.allowlistedCitationRatio,
        evaluationPassRate: metrics.overview.evaluationPassRate,
      });
    }
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

run();
