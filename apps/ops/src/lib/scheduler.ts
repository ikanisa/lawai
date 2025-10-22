import { createScheduler, type Scheduler } from '@avocat-ai/shared/scheduling';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseService, type SupabaseServiceOptions } from './supabase.js';
import { runEvaluation, createEvaluationDataSource, type CliOptions } from '../evaluate.js';

export interface OpsSchedulerContext {
  supabase: SupabaseClient | null;
  fetchImpl: typeof fetch;
  env: Record<string, string | undefined>;
}

export interface OpsSchedulerOptions {
  supabase?: SupabaseClient | null;
  fetchImpl?: typeof fetch;
  supabaseOptions?: SupabaseServiceOptions;
}

export function buildOpsScheduler(
  envOverrides: Record<string, string | undefined> = {},
  options: OpsSchedulerOptions = {},
): Scheduler<OpsSchedulerContext> {
  const env = {
    ...process.env,
    ...envOverrides,
  } as Record<string, string | undefined>;

  const supabaseConfig = {
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const shouldCreateSupabase = Boolean(supabaseConfig.url && supabaseConfig.serviceRoleKey);

  const supabase =
    options.supabase ??
    (shouldCreateSupabase
      ? createSupabaseService(
          {
            SUPABASE_URL: supabaseConfig.url!,
            SUPABASE_SERVICE_ROLE_KEY: supabaseConfig.serviceRoleKey!,
          },
          {
            ...options.supabaseOptions,
            reuseExisting: options.supabaseOptions?.reuseExisting ?? false,
          },
        )
      : null);
  const fetchImpl = options.fetchImpl ?? fetch;

  const scheduler = createScheduler<OpsSchedulerContext>({
    defaultContext: () => ({ supabase, fetchImpl, env }),
  });

  scheduler.register({
    id: 'ingestion-hourly',
    group: 'ingestion',
    description: 'Traite la file d’apprentissage côté edge en mode horaire.',
    trigger: { kind: 'cron', expression: env.INGESTION_CRON ?? '0 * * * *', timezone: env.INGESTION_TZ ?? 'UTC' },
    command: env.EDGE_PROCESS_LEARNING_URL
      ? `curl -s -X POST "${env.EDGE_PROCESS_LEARNING_URL}?mode=hourly"`
      : undefined,
    handler: async ({ fetchImpl: ctxFetch }) => {
      const endpoint = env.EDGE_PROCESS_LEARNING_URL;
      if (!endpoint) {
        return;
      }
      const response = await ctxFetch(`${endpoint}?mode=hourly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: env.INGESTION_ORG_ID ?? env.EVAL_ORG_ID ?? null }),
      });
      if (!response.ok) {
        throw new Error(`Ingestion trigger failed with status ${response.status}`);
      }
    },
  });

  scheduler.register({
    id: 'evaluation-nightly',
    group: 'evaluation',
    description: 'Exécute la campagne d’évaluation de régression nocturne.',
    trigger: { kind: 'cron', expression: env.EVALUATION_CRON ?? '0 2 * * *', timezone: env.EVALUATION_TZ ?? 'UTC' },
    command: 'npm run evaluate --workspace @apps/ops -- --ci',
    handler: async ({ supabase: ctxSupabase }) => {
      const cliOptions: CliOptions = {
        orgId: env.EVAL_ORG_ID ?? '00000000-0000-0000-0000-000000000000',
        userId: env.EVAL_USER_ID ?? env.EVAL_ORG_ID ?? '00000000-0000-0000-0000-000000000000',
        apiBaseUrl: env.API_BASE_URL ?? 'http://localhost:3000',
        limit: Number.POSITIVE_INFINITY,
        dryRun: env.EVALUATION_DRY_RUN === 'true',
        ciMode: true,
        benchmark: env.EVAL_BENCHMARK ?? null,
      };
      const summary = await runEvaluation(cliOptions, {
        dataSource: createEvaluationDataSource(ctxSupabase ?? supabase),
        fetchImpl,
        retries: 3,
        retryDelayMs: 5_000,
        logger: console,
      });

      if (summary.failed > 0 || summary.thresholdFailed) {
        const failureDetails = [
          summary.failed > 0 ? `${summary.failed} cas ont échoué` : null,
          summary.thresholdFailed && summary.thresholdFailures.length > 0
            ? `Seuils non respectés: ${summary.thresholdFailures.join(', ')}`
            : summary.thresholdFailed
              ? 'Seuils d’acceptation non respectés'
              : null,
          summary.errors.length > 0 ? `Erreurs: ${summary.errors.join('; ')}` : null,
        ]
          .filter((detail): detail is string => detail != null)
          .join(' | ');

        throw new Error(
          failureDetails.length > 0
            ? `Échec de la campagne d’évaluation nocturne: ${failureDetails}`
            : 'Échec de la campagne d’évaluation nocturne',
        );
      }
    },
  });

  scheduler.register({
    id: 'red-team-weekly',
    group: 'red-team',
    description: 'Planifie l’exercice red-team hebdomadaire.',
    trigger: { kind: 'cron', expression: env.RED_TEAM_CRON ?? '0 6 * * MON', timezone: env.RED_TEAM_TZ ?? 'UTC' },
    command: 'npm run red-team --workspace @apps/ops -- --ci',
  });

  return scheduler;
}
