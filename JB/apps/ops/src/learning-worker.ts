#!/usr/bin/env node
import ora from 'ora';
import { requireEnv } from './lib/env.js';

interface CliOptions {
  mode: 'hourly' | 'nightly' | 'reports';
  orgId?: string;
}

interface LearningResponse {
  processed?: string[];
  reports?: Array<{
    orgId: string;
    drift?: { inserted: boolean };
    evaluation?: { inserted: boolean };
    fairness?: { inserted: boolean };
    queue?: { inserted: boolean };
    error?: string;
  }>;
  queue?: Array<{ orgId: string; queue?: { inserted: boolean }; error?: string }>;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    mode: 'hourly',
    orgId: process.env.LEARNING_ORG_ID ?? undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--mode':
        {
          const value = (args[index + 1] ?? '').toLowerCase();
          if (value === 'nightly' || value === 'reports') {
            options.mode = value;
          } else {
            options.mode = 'hourly';
          }
          index += 1;
        }
        break;
      case '--org':
        options.orgId = args[index + 1];
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

export function summariseLearningResponse(payload: LearningResponse): string {
  const processed = Array.isArray(payload.processed) ? payload.processed.length : 0;
  const nightly = Array.isArray(payload.reports)
    ? payload.reports.filter((entry) => entry.drift || entry.evaluation || entry.fairness).length
    : 0;
  const fairness = Array.isArray(payload.reports)
    ? payload.reports.filter((entry) => entry.fairness).length
    : 0;
  const queue = Array.isArray(payload.queue) ? payload.queue.length : 0;
  const errors: string[] = [];

  for (const section of [...(payload.reports ?? []), ...(payload.queue ?? [])]) {
    if (section?.error) {
      errors.push(`${section.orgId}: ${section.error}`);
    }
  }

  const summary = [
    `Jobs traités: ${processed}`,
    `Rapports nocturnes: ${nightly}`,
    `Rapports équité: ${fairness}`,
    `Snapshots de file: ${queue}`,
  ];
  if (errors.length > 0) {
    summary.push(`Erreurs: ${errors.join(' | ')}`);
  }
  return summary.join(' \u2013 ');
}

async function invokeLearning(options: CliOptions): Promise<LearningResponse> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnv([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/process-learning`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      supabaseUrl: SUPABASE_URL,
      supabaseServiceRole: SUPABASE_SERVICE_ROLE_KEY,
      orgId: options.orgId ?? null,
      mode: options.mode,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Echec de l'appel process-learning (${response.status}): ${body}`);
  }

  return (await response.json()) as LearningResponse;
}

async function run(): Promise<void> {
  const options = parseArgs();
  const spinner = ora(
    options.mode === 'nightly'
      ? 'Génération des rapports nocturnes...'
      : options.mode === 'reports'
      ? 'Extraction des rapports de dérive...'
      : 'Traitement de la file d\'apprentissage...',
  ).start();

  try {
    const payload = await invokeLearning(options);
    spinner.succeed('Process-learning exécuté');
    console.log(summariseLearningResponse(payload));
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

run();
