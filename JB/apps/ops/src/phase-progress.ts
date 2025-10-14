#!/usr/bin/env node
import { Client } from 'pg';
import ora from 'ora';
import { differenceInCalendarDays } from 'date-fns';
import { loadRequiredEnv, requireEnv } from './lib/env.js';
import { createSupabaseService, getMissingAuthorityDomains, getMissingBuckets, validateResidencyGuards } from './lib/supabase.js';
import { validateVectorStore } from './lib/vector-store.js';
import { summariseAdapterFreshness, summariseJurisdictionCoverage, type AdapterRunRecord } from './lib/phase-metrics.js';
import { OFFICIAL_DOMAIN_ALLOWLIST } from '@avocat-ai/shared';

interface PhaseResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  issues: string[];
  details: string[];
}

const REQUIRED_TABLES = [
  'organizations',
  'org_members',
  'authority_domains',
  'sources',
  'documents',
  'document_chunks',
  'ingestion_runs',
  'agent_runs',
  'tool_invocations',
  'case_scores',
];

const REQUIRED_JURISDICTIONS = ['FR', 'BE', 'LU', 'CH', 'CA-QC', 'OHADA', 'MA', 'TN', 'DZ', 'RW'];
const REQUIRED_ADAPTERS = [
  'ohada-uniform-acts',
  'eu-eur-lex-core',
  'fr-legifrance-core',
  'be-justel-core',
  'lu-legilux-core',
  'mc-legimonaco-core',
  'ch-fedlex-core',
  'qc-authorities-core',
  'maghreb-gazettes',
  'rwanda-authorities',
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const jsonOutput = args.has('--json');

function formatIssueList(values: string[]): string {
  return values.map((value) => `• ${value}`).join('\n');
}

async function checkTables(connectionString: string): Promise<string[]> {
  const client = new Client({ connectionString });
  await client.connect();
  const missing: string[] = [];

  try {
    for (const table of REQUIRED_TABLES) {
      const result = await client.query<{ exists: boolean }>(
        "select to_regclass($1) is not null as exists",
        [`public.${table}`],
      );
      if (!result.rows[0]?.exists) {
        missing.push(table);
      }
    }
  } finally {
    await client.end();
  }

  return missing;
}

async function evaluateFoundation(env: Record<string, string>): Promise<PhaseResult> {
  if (!env.SUPABASE_DB_URL || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      name: 'Phase 0 – Fondation & Environnement',
      status: 'warn',
      issues: ['Variables SUPABASE_DB_URL/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY manquantes.'],
      details: [],
    };
  }
  const issues: string[] = [];
  const details: string[] = [];

  const missingTables = await checkTables(env.SUPABASE_DB_URL);
  if (missingTables.length > 0) {
    issues.push(`Tables manquantes: ${missingTables.join(', ')}`);
  } else {
    details.push('Tables essentielles présentes.');
  }

  const supabase = createSupabaseService(env);

  if (dryRun) {
    details.push('Mode simulation: vérifications Supabase (buckets, domaines, résidence) ignorées.');
  } else {
    const missingBuckets = await getMissingBuckets(supabase, ['authorities', 'uploads', 'snapshots']);
    if (missingBuckets.length > 0) {
      issues.push(`Buckets manquants: ${missingBuckets.join(', ')}`);
    } else {
      details.push('Buckets authorities/uploads/snapshots configurés.');
    }

    const residencyIssues = await validateResidencyGuards(supabase);
    if (residencyIssues.length > 0) {
      issues.push(...residencyIssues);
    } else {
      details.push('Fonctions de résidence Supabase valides.');
    }

    const missingDomains = await getMissingAuthorityDomains(supabase, OFFICIAL_DOMAIN_ALLOWLIST);
    if (missingDomains.length > 0) {
      issues.push(`Domaines officiels absents: ${missingDomains.join(', ')}`);
    } else {
      details.push('Table authority_domains synchronisée.');
    }
  }

  if (!dryRun) {
    if (!env.OPENAI_VECTOR_STORE_AUTHORITIES_ID) {
      issues.push('OPENAI_VECTOR_STORE_AUTHORITIES_ID non défini.');
    } else {
      const vectorExists = await validateVectorStore(env.OPENAI_API_KEY, env.OPENAI_VECTOR_STORE_AUTHORITIES_ID);
      if (!vectorExists) {
        issues.push('Le vector store OpenAI n’a pas été trouvé.');
      } else {
        details.push(`Vector store ${env.OPENAI_VECTOR_STORE_AUTHORITIES_ID} accessible.`);
      }
    }
  } else {
    details.push('Validation du vector store ignorée (simulation).');
  }

  return {
    name: 'Phase 0 – Fondation & Environnement',
    status: issues.length > 0 ? 'fail' : dryRun ? 'warn' : 'pass',
    issues,
    details,
  };
}

async function evaluateIngestion(env: Record<string, string>): Promise<PhaseResult> {
  if (dryRun) {
    return {
      name: 'Phase 1 – Ingestion & Provenance',
      status: 'warn',
      issues: ['Mode simulation activé: aucune donnée d’ingestion vérifiée.'],
      details: [],
    };
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      name: 'Phase 1 – Ingestion & Provenance',
      status: 'warn',
      issues: ['Identifiants Supabase manquants pour interroger les données.'],
      details: [],
    };
  }

  const supabase = createSupabaseService(env);
  const issues: string[] = [];
  const details: string[] = [];

  const sources = await supabase.from('sources').select('jurisdiction_code');
  if (sources.error) {
    issues.push(`Lecture des sources impossible: ${sources.error.message}`);
  } else {
    const coverage = summariseJurisdictionCoverage(sources.data ?? [], REQUIRED_JURISDICTIONS);
    if (coverage.missing.length > 0) {
      issues.push(`Pas de sources pour: ${coverage.missing.join(', ')}`);
    } else {
      details.push('Toutes les juridictions critiques disposent de sources.');
    }
  }

  const documents = await supabase.from('documents').select('vector_store_status, updated_at').limit(5000);
  if (documents.error) {
    issues.push(`Lecture des documents impossible: ${documents.error.message}`);
  } else {
    const statusCounts: Record<string, number> = {};
    let freshUploads = 0;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const row of documents.data ?? []) {
      const status = (row as { vector_store_status?: string }).vector_store_status ?? 'unknown';
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      const updatedAt = (row as { updated_at?: string }).updated_at;
      if (status === 'uploaded' && updatedAt) {
        const age = differenceInCalendarDays(new Date(), new Date(updatedAt));
        if (age <= 7) {
          freshUploads += 1;
        }
      }
    }

    if ((statusCounts.uploaded ?? 0) === 0) {
      issues.push('Aucun document synchronisé avec le vector store.');
    } else {
      details.push(`Documents synchronisés: ${statusCounts.uploaded ?? 0}`);
    }

    if (statusCounts.failed && statusCounts.failed > 0) {
      issues.push(`${statusCounts.failed} document(s) en échec de synchronisation.`);
    }

    if (freshUploads > 0) {
      details.push(`${freshUploads} document(s) synchronisés au cours des 7 derniers jours.`);
    }
  }

  const adapterRuns = await supabase
    .from('ingestion_runs')
    .select('adapter_id, finished_at')
    .eq('status', 'completed')
    .order('finished_at', { ascending: false })
    .limit(200);

  if (adapterRuns.error) {
    issues.push(`Lecture des exécutions d’ingestion impossible: ${adapterRuns.error.message}`);
  } else {
    const summary = summariseAdapterFreshness((adapterRuns.data ?? []) as AdapterRunRecord[], REQUIRED_ADAPTERS, 72);
    if (summary.missing.length > 0) {
      issues.push(`Aucune exécution complète pour: ${summary.missing.join(', ')}`);
    }
    if (summary.stale.length > 0) {
      for (const item of summary.stale) {
        issues.push(
          `Adapter ${item.adapterId} obsolète (dernière exécution il y a ${item.ageHours ?? '?'} h).`,
        );
      }
    }
    if (summary.missing.length === 0 && summary.stale.length === 0) {
      details.push('Tous les adaptateurs critiques ont une exécution récente.');
    }
  }

  return {
    name: 'Phase 1 – Ingestion & Provenance',
    status: issues.length > 0 ? 'fail' : 'pass',
    issues,
    details,
  };
}

async function evaluateAgent(env: Record<string, string>): Promise<PhaseResult> {
  if (dryRun) {
    return {
      name: 'Phase 2 – Agent, HITL & Gouvernance',
      status: 'warn',
      issues: ['Mode simulation activé: exécution agent/HITL non vérifiée.'],
      details: [],
    };
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      name: 'Phase 2 – Agent, HITL & Gouvernance',
      status: 'warn',
      issues: ['Identifiants Supabase manquants pour analyser les exécutions agent.'],
      details: [],
    };
  }

  const supabase = createSupabaseService(env);
  const issues: string[] = [];
  const details: string[] = [];

  const runCount = await supabase.from('agent_runs').select('id', { count: 'exact', head: true });
  if (runCount.error) {
    issues.push(`Impossible de lire agent_runs: ${runCount.error.message}`);
  } else if ((runCount.count ?? 0) === 0) {
    issues.push('Aucune exécution agent enregistrée.');
  } else {
    details.push(`${runCount.count ?? 0} exécutions agent enregistrées.`);
  }

  const citationFailures = await supabase
    .from('run_citations')
    .select('id', { count: 'exact', head: true })
    .eq('domain_ok', false);
  if (citationFailures.error) {
    issues.push(`Impossible de vérifier les citations: ${citationFailures.error.message}`);
  } else if ((citationFailures.count ?? 0) > 0) {
    issues.push(`${citationFailures.count} citation(s) hors allowlist détectée(s).`);
  } else {
    details.push('Toutes les citations enregistrées respectent la allowlist.');
  }

  const caseScores = await supabase.from('case_scores').select('id', { count: 'exact', head: true });
  if (caseScores.error) {
    issues.push(`Impossible de vérifier case_scores: ${caseScores.error.message}`);
  } else if ((caseScores.count ?? 0) === 0) {
    issues.push('Aucun score de jurisprudence calculé.');
  } else {
    details.push(`${caseScores.count ?? 0} scores de jurisprudence disponibles.`);
  }

  const auditEvents = await supabase.from('audit_events').select('id', { count: 'exact', head: true });
  if (auditEvents.error) {
    issues.push(`Impossible de lire audit_events: ${auditEvents.error.message}`);
  } else if ((auditEvents.count ?? 0) === 0) {
    issues.push('Aucun événement d’audit consigné.');
  } else {
    details.push('Audit trail actif.');
  }

  return {
    name: 'Phase 2 – Agent, HITL & Gouvernance',
    status: issues.length > 0 ? 'fail' : 'pass',
    issues,
    details,
  };
}

async function main(): Promise<void> {
  const baseEnv = loadRequiredEnv(['SUPABASE_DB_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (baseEnv.missing.length > 0 && !dryRun) {
    throw new Error(`Variables d'environnement manquantes: ${baseEnv.missing.join(', ')}`);
  }

  let env: Record<string, string> = { ...baseEnv.values };
  if (!dryRun) {
    env = requireEnv([
      'SUPABASE_DB_URL',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY',
      'OPENAI_VECTOR_STORE_AUTHORITIES_ID',
    ]);
  } else {
    const optional = loadRequiredEnv(['OPENAI_API_KEY', 'OPENAI_VECTOR_STORE_AUTHORITIES_ID']);
    env = { ...env, ...optional.values };
  }

  const phases = [] as PhaseResult[];
  phases.push(await evaluateFoundation(env));
  phases.push(await evaluateIngestion(env));
  phases.push(await evaluateAgent(env));

  if (jsonOutput) {
    console.log(JSON.stringify(phases, null, 2));
  } else {
    for (const phase of phases) {
      const spinner = ora(phase.name);
      if (phase.status === 'pass') {
        spinner.succeed(`${phase.name} — OK`);
      } else if (phase.status === 'warn') {
        spinner.warn(`${phase.name} — À vérifier`);
      } else {
        spinner.fail(`${phase.name} — Incomplet`);
      }
      if (phase.details.length > 0) {
        console.log(`  Détails:\n${formatIssueList(phase.details)}`);
      }
      if (phase.issues.length > 0) {
        console.log(`  Points bloquants:\n${formatIssueList(phase.issues)}`);
      }
      console.log('');
    }
  }

  const hasFailure = phases.some((phase) => phase.status === 'fail');
  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
