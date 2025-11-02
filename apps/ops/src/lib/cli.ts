import ora, { Ora } from 'ora';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OFFICIAL_DOMAIN_ALLOWLIST, SupabaseScheduler } from '@avocat-ai/shared';
import { requireEnv } from './env.js';
import { createSupabaseService, type SupabaseClientFactory } from './supabase.js';

export type ScheduleKind = 'ingestion' | 'red-team' | 'evaluation' | 'gdpr';

export interface CliOptions {
  command: 'status' | 'schedule';
  orgId?: string;
  kind?: ScheduleKind;
  adapter?: string;
  scenario?: string;
  benchmark?: string;
  scope?: string;
  retries: number;
  retryDelay: number;
}

export interface SpinnerLike {
  start(text: string): SpinnerLike;
  succeed(text?: string): SpinnerLike;
  fail(text?: string): SpinnerLike;
  info(text: string): SpinnerLike;
  warn(text: string): SpinnerLike;
  stop(): SpinnerLike;
  text: string;
}

export interface OpsCliDependencies {
  env?: Record<string, string>;
  createClient?: (env: Record<string, string>) => SupabaseClient;
  supabaseFactory?: SupabaseClientFactory;
  schedulerFactory?: (client: SupabaseClient) => SupabaseScheduler;
  spinnerFactory?: () => SpinnerLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  out?: Pick<typeof console, 'log' | 'error' | 'table'>;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 500;

function defaultSpinnerFactory(): SpinnerLike {
  const spinner: Ora = ora({ isEnabled: process.stderr.isTTY });
  return {
    start(text: string) {
      spinner.start(text);
      return this;
    },
    succeed(text?: string) {
      spinner.succeed(text);
      return this;
    },
    fail(text?: string) {
      spinner.fail(text);
      return this;
    },
    info(text: string) {
      spinner.info(text);
      return this;
    },
    warn(text: string) {
      spinner.warn(text);
      return this;
    },
    stop() {
      spinner.stop();
      return this;
    },
    get text() {
      return spinner.text;
    },
    set text(value: string) {
      spinner.text = value;
    },
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: 'status',
    retries: DEFAULT_RETRIES,
    retryDelay: DEFAULT_RETRY_DELAY,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--org':
        options.orgId = argv[index + 1] ?? options.orgId;
        index += 1;
        break;
      case '--schedule':
        options.command = 'schedule';
        options.kind = (argv[index + 1] ?? options.kind) as ScheduleKind;
        index += 1;
        break;
      case '--adapter':
        options.adapter = argv[index + 1] ?? options.adapter;
        index += 1;
        break;
      case '--scenario':
        options.scenario = argv[index + 1] ?? options.scenario;
        index += 1;
        break;
      case '--benchmark':
        options.benchmark = argv[index + 1] ?? options.benchmark;
        index += 1;
        break;
      case '--scope':
        options.scope = argv[index + 1] ?? options.scope;
        index += 1;
        break;
      case '--retries': {
        const parsed = Number.parseInt(argv[index + 1] ?? '', 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          options.retries = parsed;
        }
        index += 1;
        break;
      }
      case '--retry-delay': {
        const parsed = Number.parseInt(argv[index + 1] ?? '', 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          options.retryDelay = parsed;
        }
        index += 1;
        break;
      }
      default:
        break;
    }
  }

  return options;
}

async function withRetries<T>(
  operation: () => Promise<T>,
  retries: number,
  delayMs: number,
  sleep: (ms: number) => Promise<void>,
  onRetry: (attempt: number, error: unknown) => void,
): Promise<T> {
  let attempt = 0;
  // Attempt up to retries + 1 (initial try + retries)
  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      onRetry(attempt + 1, error);
      await sleep(delayMs);
      attempt += 1;
    }
  }
  throw new Error('Retry exhaustion without execution');
}

async function fetchJurisdictions(
  client: SupabaseClient,
  retries: number,
  delay: number,
  sleep: (ms: number) => Promise<void>,
  spinner: SpinnerLike,
): Promise<Array<{ code: string; name: string }>> {
  return withRetries(
    async () => {
      const response = await client.from('jurisdictions').select('code, name').limit(5);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return (response.data ?? []) as Array<{ code: string; name: string }>;
    },
    retries,
    delay,
    sleep,
    (attempt, error) => {
      const message = error instanceof Error ? error.message : String(error);
      spinner.warn(`Tentative ${attempt} échouée: ${message}`);
      spinner.start('Nouvelle tentative...');
    },
  );
}

function validateScheduleOptions(options: CliOptions): void {
  if (!options.kind) {
    throw new Error('Veuillez préciser le type de tâche via --schedule <ingestion|red-team|evaluation|gdpr>.');
  }
  if (!options.orgId) {
    throw new Error('Veuillez préciser l\'organisation cible via --org <uuid>.');
  }
  if (options.kind === 'ingestion' && !options.adapter) {
    throw new Error('L\'adapter d\'ingestion est requis (--adapter <id>).');
  }
  if (options.kind === 'red-team' && !options.scenario) {
    throw new Error('Le scénario red-team est requis (--scenario <clé>).');
  }
  if (options.kind === 'evaluation' && !options.benchmark) {
    throw new Error('Le benchmark d\'évaluation est requis (--benchmark <nom>).');
  }
}

async function scheduleTask(
  scheduler: SupabaseScheduler,
  options: CliOptions,
  spinner: SpinnerLike,
): Promise<string> {
  validateScheduleOptions(options);
  switch (options.kind) {
    case 'ingestion':
      await scheduler.scheduleIngestion(options.orgId as string, options.adapter as string);
      spinner.succeed(`Ingestion planifiée pour ${options.orgId}`);
      return `Adapter ${options.adapter} en file.`;
    case 'red-team':
      await scheduler.scheduleRedTeam(options.orgId as string, options.scenario as string);
      spinner.succeed(`Red-team planifié pour ${options.orgId}`);
      return `Scénario ${options.scenario} en file.`;
    case 'evaluation':
      await scheduler.scheduleEvaluation(options.orgId as string, options.benchmark as string);
      spinner.succeed(`Évaluation planifiée pour ${options.orgId}`);
      return `Benchmark ${options.benchmark} en file.`;
    case 'gdpr':
      await scheduler.scheduleGdprRetention(options.orgId as string, options.scope ? { scope: options.scope } : {});
      spinner.succeed(`Nettoyage RGPD planifié pour ${options.orgId}`);
      return options.scope
        ? `Contexte ${options.scope} en file.`
        : 'Politique complète en file.';
    default:
      throw new Error(`Type de tâche inconnu: ${options.kind}`);
  }
}

export async function runOpsCli(argv: string[], deps: OpsCliDependencies = {}): Promise<number> {
  const options = parseArgs(argv);
  const spinner = deps.spinnerFactory ? deps.spinnerFactory() : defaultSpinnerFactory();
  const sleep = deps.sleep ?? defaultSleep;
  const output = deps.out ?? console;
  const now = deps.now ?? (() => new Date());

  spinner.start('Initialisation du client Supabase...');

  try {
    const env = deps.env ?? requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const createClient =
      deps.createClient ?? ((values: Record<string, string>) => createSupabaseService(values, deps.supabaseFactory));
    const client = createClient(env);
    spinner.succeed('Client Supabase initialisé');

    if (options.command === 'status') {
      spinner.start('Lecture des juridictions...');
      try {
        const data = await fetchJurisdictions(client, options.retries, options.retryDelay, sleep, spinner);
        spinner.succeed('Juridictions chargées');
        output.table(data);
        output.log('Domaines officiels suivis:', OFFICIAL_DOMAIN_ALLOWLIST.slice(0, 5));
        output.log(`Dernière exécution: ${now().toISOString()}`);
        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        spinner.fail('Impossible de lire les juridictions');
        output.error(message);
        return 1;
      }
    }

    const schedulerFactory = deps.schedulerFactory ?? ((supabase: SupabaseClient) => new SupabaseScheduler(supabase));
    const scheduler = schedulerFactory(client);
    spinner.start('Planification de la tâche...');

    try {
      const summary = await scheduleTask(scheduler, options, spinner);
      output.log(summary);
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spinner.fail('Planification impossible');
      output.error(message);
      return 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail('Configuration invalide');
    (deps.out ?? console).error(message);
    return 1;
  } finally {
    spinner.stop();
  }
}
