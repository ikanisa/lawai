#!/usr/bin/env node
import ora from 'ora';
import { formatISO, subDays } from 'date-fns';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { initNodeTelemetry } from '@avocat-ai/observability';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './lib/env.js';
import { createSupabaseService } from './lib/supabase.js';

interface OrganizationRecord {
  id: string;
  name?: string | null;
}

type RetentionScope = 'runs' | 'chat' | 'audit' | 'consent';

interface RetentionPolicy {
  runsDays: number;
  chatDays: number;
  auditDays: number;
  consentDays: number;
}

interface CliOptions {
  orgId?: string;
  dryRun: boolean;
  scopes: Set<RetentionScope>;
}

interface DatasetSummary {
  scope: RetentionScope;
  deleted: number;
  retentionDays: number;
  cutoff: string;
}

const DEFAULT_POLICY: RetentionPolicy = {
  runsDays: 180,
  chatDays: 90,
  auditDays: 365,
  consentDays: 365,
};

const VALID_SCOPES: RetentionScope[] = ['runs', 'chat', 'audit', 'consent'];

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    dryRun: false,
    orgId: undefined,
    scopes: new Set<RetentionScope>(VALID_SCOPES),
  };
  let scopesOverridden = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--org':
        options.orgId = args[index + 1] ?? options.orgId;
        index += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--scope': {
        const value = args[index + 1];
        index += 1;
        if (!scopesOverridden) {
          options.scopes.clear();
          scopesOverridden = true;
        }
        if (typeof value === 'string') {
          for (const raw of value.split(',')) {
            const normalised = raw.trim().toLowerCase();
            if (VALID_SCOPES.includes(normalised as RetentionScope)) {
              options.scopes.add(normalised as RetentionScope);
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }

  if (options.scopes.size === 0) {
    options.scopes = new Set<RetentionScope>(VALID_SCOPES);
  }

  return options;
}

function coerceDays(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }
  return null;
}

function parseRetentionPolicy(raw: unknown): Partial<RetentionPolicy> {
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }
  const source = raw as Record<string, unknown>;
  const mapping: Array<[keyof RetentionPolicy, string[]]> = [
    ['runsDays', ['runsDays', 'runs', 'run_days', 'agent_runs_days']],
    ['chatDays', ['chatDays', 'chat', 'chat_sessions_days', 'messagesDays']],
    ['auditDays', ['auditDays', 'audit', 'audit_events_days']],
    ['consentDays', ['consentDays', 'consent', 'consent_events_days']],
  ];

  const overrides: Partial<RetentionPolicy> = {};
  for (const [target, keys] of mapping) {
    for (const key of keys) {
      if (key in source) {
        const days = coerceDays(source[key]);
        if (days !== null) {
          overrides[target] = days;
          break;
        }
      }
    }
  }
  return overrides;
}

function mergePolicy(overrides: Partial<RetentionPolicy> | null | undefined): RetentionPolicy {
  return {
    runsDays: overrides?.runsDays ?? DEFAULT_POLICY.runsDays,
    chatDays: overrides?.chatDays ?? DEFAULT_POLICY.chatDays,
    auditDays: overrides?.auditDays ?? DEFAULT_POLICY.auditDays,
    consentDays: overrides?.consentDays ?? DEFAULT_POLICY.consentDays,
  };
}

async function fetchOrganizations(client: SupabaseClient, orgId?: string): Promise<OrganizationRecord[]> {
  let query = client.from('organizations').select('id, name');
  if (orgId) {
    query = query.eq('id', orgId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Impossible de lire les organisations: ${error.message}`);
  }
  return (data ?? []) as OrganizationRecord[];
}

async function fetchRetentionOverrides(
  client: SupabaseClient,
  orgIds: string[],
): Promise<Record<string, Partial<RetentionPolicy>>> {
  if (orgIds.length === 0) {
    return {};
  }
  const { data, error } = await client
    .from('org_policies')
    .select('org_id, value')
    .eq('key', 'retention')
    .in('org_id', orgIds);
  if (error) {
    throw new Error(`Impossible de lire les politiques de rétention: ${error.message}`);
  }
  const result: Record<string, Partial<RetentionPolicy>> = {};
  for (const record of data ?? []) {
    if (!record || typeof record.org_id !== 'string') {
      continue;
    }
    result[record.org_id] = parseRetentionPolicy(record.value);
  }
  return result;
}

async function countOrDelete(
  client: SupabaseClient,
  table: string,
  column: string,
  orgId: string,
  cutoffIso: string,
  dryRun: boolean,
): Promise<number> {
  if (dryRun) {
    const { error, count } = await client
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .lt(column, cutoffIso);
    if (error) {
      throw new Error(`Impossible de compter ${table}: ${error.message}`);
    }
    return count ?? 0;
  }
  const { error, count } = await client
    .from(table)
    .delete({ count: 'exact' })
    .eq('org_id', orgId)
    .lt(column, cutoffIso);
  if (error) {
    throw new Error(`Impossible de purger ${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function enforcePolicyForOrg(
  client: SupabaseClient,
  org: OrganizationRecord,
  policy: RetentionPolicy,
  scopes: Set<RetentionScope>,
  dryRun: boolean,
): Promise<DatasetSummary[]> {
  const tracer = trace.getTracer('ops-gdpr-retention');
  const now = new Date();
  const datasets: DatasetSummary[] = [];

  await tracer.startActiveSpan('gdpr.retention.org', async (span) => {
    span.setAttribute('org.id', org.id);
    if (org.name) {
      span.setAttribute('org.name', org.name);
    }
    span.setAttribute('gdpr.dry_run', dryRun);

    try {
      const operations: Array<{ scope: RetentionScope; days: number; table: string; column: string }> = [
        { scope: 'runs', days: policy.runsDays, table: 'agent_runs', column: 'started_at' },
        { scope: 'chat', days: policy.chatDays, table: 'chat_sessions', column: 'created_at' },
        { scope: 'audit', days: policy.auditDays, table: 'audit_events', column: 'created_at' },
        { scope: 'consent', days: policy.consentDays, table: 'consent_events', column: 'created_at' },
      ];

      for (const operation of operations) {
        if (!scopes.has(operation.scope)) {
          continue;
        }
        if (!Number.isFinite(operation.days) || operation.days <= 0) {
          continue;
        }
        const cutoff = subDays(now, operation.days);
        const cutoffIso = formatISO(cutoff);
        const deleted = await countOrDelete(client, operation.table, operation.column, org.id, cutoffIso, dryRun);
        datasets.push({
          scope: operation.scope,
          deleted,
          retentionDays: operation.days,
          cutoff: cutoffIso,
        });
        span.addEvent('gdpr.retention.dataset', {
          'gdpr.scope': operation.scope,
          'gdpr.cutoff': cutoffIso,
          'gdpr.deleted': deleted,
          'gdpr.retention_days': operation.days,
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });

  return datasets;
}

async function main(): Promise<number> {
  const options = parseArgs();
  const spinner = ora('Initialisation du client Supabase...').start();
  const telemetry = await initNodeTelemetry({
    serviceName: 'ops-gdpr-retention',
    environment: process.env.NODE_ENV ?? 'development',
  });

  try {
    const env = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const client = createSupabaseService(env);
    spinner.text = 'Lecture des organisations...';
    const organizations = await fetchOrganizations(client, options.orgId);
    spinner.succeed(`Organisations ciblées: ${organizations.length}`);

    if (organizations.length === 0) {
      console.log('Aucune organisation à traiter.');
      await telemetry.shutdown();
      return 0;
    }

    const overrides = await fetchRetentionOverrides(
      client,
      organizations.map((org) => org.id),
    );

    const summaries: Array<{ orgId: string; scope: RetentionScope; deleted: number; cutoff: string; retentionDays: number }>
      = [];

    for (const org of organizations) {
      const policy = mergePolicy(overrides[org.id]);
      spinner.start(`Application des politiques pour ${org.name ?? org.id}...`);
      try {
        const datasets = await enforcePolicyForOrg(client, org, policy, options.scopes, options.dryRun);
        const total = datasets.reduce((sum, entry) => sum + entry.deleted, 0);
        const label = options.dryRun ? 'élément(s) identifiés' : 'élément(s) supprimés';
        spinner.succeed(`${org.name ?? org.id}: ${total} ${label}`);
        for (const dataset of datasets) {
          summaries.push({
            orgId: org.id,
            scope: dataset.scope,
            deleted: dataset.deleted,
            cutoff: dataset.cutoff,
            retentionDays: dataset.retentionDays,
          });
        }
      } catch (error) {
        spinner.fail(`Échec pour ${org.name ?? org.id}`);
        console.error(error instanceof Error ? error.message : error);
        await telemetry.shutdown();
        return 1;
      }
    }

    if (summaries.length > 0) {
      console.table(
        summaries.map((entry) => ({
          organisation: entry.orgId,
          dataset: entry.scope,
          supprimés: entry.deleted,
          'rétention (jours)': entry.retentionDays,
          'date limite': entry.cutoff,
        })),
      );
    } else {
      console.log('Aucun enregistrement à nettoyer selon les politiques actuelles.');
    }

    await telemetry.shutdown();
    return 0;
  } catch (error) {
    spinner.fail('Erreur lors de la préparation du nettoyage');
    console.error(error instanceof Error ? error.message : error);
    await telemetry.shutdown();
    return 1;
  }
}

const exitCode = await main();
if (exitCode !== 0) {
  process.exitCode = exitCode;
}
