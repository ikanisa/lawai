#!/usr/bin/env node
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ora from 'ora';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadRequiredEnv } from './lib/env.js';
import { createSupabaseService } from './lib/supabase.js';
import { evaluateExpectedTerms } from './lib/evaluation.js';
import { createOpenAIEvalsClient, type EvalJobMetrics, type EvalJobResult } from './lib/openai-evals.js';
import { serverEnv } from './env.server.js';
import type { IRACPayload } from '@avocat-ai/shared';
import {
  ACCEPTANCE_THRESHOLDS,
  MAGHREB_JURISDICTIONS,
  getJurisdictionsForDomain,
} from '@avocat-ai/shared';

interface CliOptions {
  orgId: string;
  userId: string;
  apiBaseUrl: string;
  limit: number;
  dryRun: boolean;
  ciMode: boolean;
  benchmark?: string | null;
}

const FALLBACK_CASES: Array<{
  id: string;
  name: string;
  prompt: string;
  expected_contains: string[];
  benchmark?: string;
}> = [
  {
    id: 'local-fr-responsabilite',
    name: 'FR - Responsabilité délictuelle',
    prompt: "Quels sont les critères de mise en jeu de la responsabilité délictuelle pour un dommage causé par un salarié en France ?",
    expected_contains: ['code civil', '1240', 'faute'],
    benchmark: 'fallback',
  },
  {
    id: 'local-ohada-suretes',
    name: 'OHADA - Sûretés mobilières',
    prompt: "Dans le cadre OHADA, quelles sont les exigences pour constituer un gage sans dépossession sur un stock de marchandises ?",
    expected_contains: ['acte uniforme', 'sûretés', 'ccja'],
    benchmark: 'fallback',
  },
  {
    id: 'local-ma-nonconcurrence',
    name: 'MA - Clause de non-concurrence',
    prompt: "Au Maroc, quelles conditions rendent valable une clause de non-concurrence insérée dans un contrat de travail ?",
    expected_contains: ['bulletin officiel', 'code du travail', 'traduction'],
    benchmark: 'fallback',
  },
  {
    id: 'local-be-consommation',
    name: 'BE - Clauses abusives B2C',
    prompt:
      "En Belgique, quelles règles du Code de droit économique encadrent les clauses abusives dans les contrats conclus avec les consommateurs ?",
    expected_contains: ['code de droit économique', 'clause abusive', 'justel'],
    benchmark: 'fallback',
  },
  {
    id: 'local-lu-sarl',
    name: 'LU - Cession de parts de SARL',
    prompt:
      "Au Luxembourg, quelles formalités s'appliquent à la cession de parts sociales d'une SARL et quelles références légales doivent être citées ?",
    expected_contains: ['legilux', 'sarl', 'parts sociales'],
    benchmark: 'fallback',
  },
  {
    id: 'local-ch-ldip',
    name: 'CH - Conflits de lois (LDIP)',
    prompt:
      "Selon la LDIP suisse, quels critères permettent de déterminer la compétence des tribunaux et la loi applicable lorsqu'un contrat présente des éléments internationaux ?",
    expected_contains: ['ldip', 'tribunal fédéral', 'droit international privé'],
    benchmark: 'fallback',
  },
  {
    id: 'local-ca-qc-delais',
    name: 'QC - Délais procéduraux',
    prompt:
      "Au Québec, quels délais prévus au Code de procédure civile s'appliquent pour signifier une demande introductive d'instance en matière civile ?",
    expected_contains: ['code de procédure civile', 'c.p.c.', 'signification'],
    benchmark: 'fallback',
  },
  {
    id: 'local-rw-gazette',
    name: 'RW - Publication au Journal officiel',
    prompt:
      "Au Rwanda, quelles sont les exigences de publication au Journal officiel pour qu'une loi entre en vigueur et quel avertissement linguistique faut-il rappeler ?",
    expected_contains: ['gazette officielle', 'amategeko', 'langue'],
    benchmark: 'fallback',
  },
];

type DatasetMap = Record<string, string>;

function parseDatasetMapping(): DatasetMap {
  const raw = serverEnv.OPENAI_EVAL_DATASET_MAP;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.entries(parsed).reduce<DatasetMap>((acc, [key, value]) => {
      if (typeof value === 'string' && value.length > 0) {
        acc[key.trim().toLowerCase()] = value;
      }
      return acc;
    }, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`OPENAI_EVAL_DATASET_MAP invalid JSON: ${message}`);
    return {};
  }
}

function normaliseScenarioName(input: string | null | undefined): string {
  if (!input) {
    return 'fallback';
  }
  return input.trim().toLowerCase();
}

const MAGHREB_JURISDICTION_SET = new Set<string>(
  MAGHREB_JURISDICTIONS.map((code) => code.toUpperCase()),
);

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BENCHMARKS_DIR = path.resolve(CURRENT_DIR, '../fixtures/benchmarks');

export async function loadBenchmarkCases(name: string): Promise<
  Array<{ id: string; name: string; prompt: string; expected_contains: string[]; benchmark: string }>
> {
  const safeName = name.trim().toLowerCase();
  if (safeName.length === 0) {
    throw new Error('Benchmark name cannot be empty');
  }
  const filePath = path.join(BENCHMARKS_DIR, `${safeName}.json`);
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Benchmark file malformed');
    }
    return parsed.map((entry, index) => ({
      id: typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : `${safeName}-${index}`,
      name: typeof entry.name === 'string' ? entry.name : `${safeName.toUpperCase()} ${index + 1}`,
      prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
      expected_contains: Array.isArray(entry.expected_contains)
        ? (entry.expected_contains as string[])
        : [],
      benchmark: safeName,
    }));
  } catch (error) {
    const message =
      error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? `Benchmark inconnu: ${safeName}`
        : error instanceof Error
        ? error.message
        : 'benchmark_load_failed';
    throw new Error(message);
  }
}

export interface CaseMetricsSummary {
  citationPrecision: number;
  temporalValidity: number;
  bindingWarnings: number;
  jurisdiction: string | null;
  maghrebBanner: boolean | null;
}

export function computeMetrics(payload: IRACPayload): CaseMetricsSummary {
  const totalCitations = payload.citations.length;
  let allowlistedCount = 0;
  let bindingWarnings = 0;

  const jurisdictionCode = payload.jurisdiction?.country
    ? payload.jurisdiction.country.toUpperCase()
    : null;
  const isMaghreb = jurisdictionCode ? MAGHREB_JURISDICTION_SET.has(jurisdictionCode) : false;

  for (const citation of payload.citations) {
    try {
      const host = new URL(citation.url).hostname.toLowerCase();
      if (getJurisdictionsForDomain(host).length > 0) {
        allowlistedCount += 1;
      }
    } catch (_error) {
      // Ignore malformed URLs
    }
    if (citation.note && citation.note.toLowerCase().includes('traduction')) {
      bindingWarnings += 1;
    }
  }

  const precision = totalCitations === 0 ? 0 : allowlistedCount / totalCitations;

  const rules = payload.rules ?? [];
  const now = Date.now();
  const validRules = rules.filter((rule) => {
    if (!rule.effective_date) return true;
    const time = Date.parse(rule.effective_date);
    return Number.isFinite(time) ? time <= now : true;
  }).length;
  const temporalValidity = rules.length === 0 ? 1 : validRules / rules.length;

  let maghrebBanner: boolean | null = null;
  if (isMaghreb) {
    maghrebBanner = payload.citations.some((citation) => {
      const note = citation.note ? citation.note.toLowerCase() : '';
      return note.includes('traduction') || note.includes('langue');
    });
  }

  return {
    citationPrecision: Number.isFinite(precision) ? precision : 0,
    temporalValidity: Number.isFinite(temporalValidity) ? temporalValidity : 0,
    bindingWarnings,
    jurisdiction: jurisdictionCode,
    maghrebBanner,
  };
}

export function checkAcceptanceThresholds(entries: CaseMetricsSummary[]) {
  if (entries.length === 0) {
    return {
      ok: true,
      failures: [] as string[],
      coverage: {
        citationPrecision: 1,
        temporalValidity: 1,
        maghrebBanner: 1,
      },
    };
  }

  const precisionCoverage =
    entries.filter((entry) => entry.citationPrecision >= ACCEPTANCE_THRESHOLDS.citationsAllowlistedP95).length /
    entries.length;
  const temporalCoverage =
    entries.filter((entry) => entry.temporalValidity >= ACCEPTANCE_THRESHOLDS.temporalValidityP95).length /
    entries.length;

  const maghrebEntries = entries.filter((entry) =>
    entry.jurisdiction ? MAGHREB_JURISDICTION_SET.has(entry.jurisdiction.toUpperCase()) : false,
  );
  const maghrebCoverage =
    maghrebEntries.length === 0
      ? 1
      : maghrebEntries.filter((entry) => entry.maghrebBanner === true).length / maghrebEntries.length;

  const failures: string[] = [];
  if (precisionCoverage < ACCEPTANCE_THRESHOLDS.citationsAllowlistedP95) {
    failures.push(
      `Couverture précision allowlist ${(precisionCoverage * 100).toFixed(1)}% < ${(
        ACCEPTANCE_THRESHOLDS.citationsAllowlistedP95 * 100
      ).toFixed(0)}%`,
    );
  }
  if (temporalCoverage < ACCEPTANCE_THRESHOLDS.temporalValidityP95) {
    failures.push(
      `Couverture validité temporelle ${(temporalCoverage * 100).toFixed(1)}% < ${(
        ACCEPTANCE_THRESHOLDS.temporalValidityP95 * 100
      ).toFixed(0)}%`,
    );
  }
  if (maghrebCoverage < ACCEPTANCE_THRESHOLDS.maghrebBindingBannerCoverage) {
    failures.push(
      `Couverture bannière Maghreb ${(maghrebCoverage * 100).toFixed(1)}% < ${(
        ACCEPTANCE_THRESHOLDS.maghrebBindingBannerCoverage * 100
      ).toFixed(0)}%`,
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    coverage: {
      citationPrecision: precisionCoverage,
      temporalValidity: temporalCoverage,
      maghrebBanner: maghrebCoverage,
    },
  };
}

export interface LinkHealthSummary {
  totalSources: number;
  failedSources: number;
  staleSources: number;
  failureRatio: number;
}

export async function fetchLinkHealthSummary(
  supabase: SupabaseClient | null,
  orgId: string,
): Promise<LinkHealthSummary | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('org_provenance_metrics')
    .select('total_sources, sources_link_failed, sources_link_stale')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) {
    throw new Error(`Impossible de récupérer le statut des liens: ${error.message}`);
  }

  const total = data?.total_sources ?? 0;
  const failed = data?.sources_link_failed ?? 0;
  const stale = data?.sources_link_stale ?? 0;
  const ratio = total > 0 ? failed / total : 0;

  return {
    totalSources: total,
    failedSources: failed,
    staleSources: stale,
    failureRatio: ratio,
  };
}

export function checkLinkHealthThreshold(summary: LinkHealthSummary | null) {
  if (!summary || summary.totalSources === 0) {
    return { ok: true, failure: null as string | null };
  }

  if (summary.failureRatio > ACCEPTANCE_THRESHOLDS.linkHealthFailureRatioMax) {
    const failure = `Liens officiels défaillants ${(summary.failureRatio * 100).toFixed(1)}% > ${(
      ACCEPTANCE_THRESHOLDS.linkHealthFailureRatioMax * 100
    ).toFixed(0)}%`;
    return { ok: false, failure };
  }

  return { ok: true, failure: null as string | null };
}

interface RemoteThresholdResult {
  ok: boolean;
  failures: string[];
}

function evaluateRemoteMetricsAgainstThresholds(metrics: EvalJobMetrics): RemoteThresholdResult {
  const failures: string[] = [];

  const precision = metrics.allowlistedCitationPrecisionP95;
  if (precision == null) {
    failures.push('Précision allowlist P95 non rapportée par le job.');
  } else if (precision < ACCEPTANCE_THRESHOLDS.citationsAllowlistedP95) {
    failures.push(
      `Précision allowlist ${(precision * 100).toFixed(1)}% < ${(
        ACCEPTANCE_THRESHOLDS.citationsAllowlistedP95 * 100
      ).toFixed(0)}%`,
    );
  }

  const temporal = metrics.temporalValidityP95;
  if (temporal == null) {
    failures.push('Validité temporelle P95 non rapportée par le job.');
  } else if (temporal < ACCEPTANCE_THRESHOLDS.temporalValidityP95) {
    failures.push(
      `Validité temporelle ${(temporal * 100).toFixed(1)}% < ${(
        ACCEPTANCE_THRESHOLDS.temporalValidityP95 * 100
      ).toFixed(0)}%`,
    );
  }

  const maghreb = metrics.maghrebBannerCoverage;
  if (maghreb == null) {
    failures.push('Couverture bannière Maghreb non rapportée par le job.');
  } else if (maghreb < ACCEPTANCE_THRESHOLDS.maghrebBindingBannerCoverage) {
    failures.push(
      `Couverture bannière Maghreb ${(maghreb * 100).toFixed(1)}% < ${(
        ACCEPTANCE_THRESHOLDS.maghrebBindingBannerCoverage * 100
      ).toFixed(0)}%`,
    );
  }

  const hitl = metrics.hitlRecallHighRisk;
  if (hitl == null) {
    failures.push('Rappel HITL (haute criticité) non rapporté par le job.');
  } else if (hitl < ACCEPTANCE_THRESHOLDS.hitlRecallHighRisk) {
    failures.push(
      `Rappel HITL ${(hitl * 100).toFixed(1)}% < ${(
        ACCEPTANCE_THRESHOLDS.hitlRecallHighRisk * 100
      ).toFixed(0)}%`,
    );
  }

  return { ok: failures.length === 0, failures };
}

function formatPercentage(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return 'N/A';
  }
  return `${(value * 100).toFixed(1)}%`;
}

async function recordEvalJobLearningEntry(
  supabase: SupabaseClient | null,
  orgId: string,
  scenario: string,
  datasetId: string,
  job: EvalJobResult,
): Promise<void> {
  if (!supabase) {
    return;
  }

  const statusMap: Record<EvalJobResult['status'], string> = {
    completed: 'COMPLETED',
    failed: 'FAILED',
    cancelled: 'CANCELLED',
    running: 'RUNNING',
    queued: 'QUEUED',
  };

  const payload = {
    org_id: orgId,
    job_type: 'eval_metrics',
    status: statusMap[job.status] ?? 'RECORDED',
    payload: {
      scenario,
      dataset_id: datasetId,
      job_id: job.id,
      agent_id: job.agentId,
      status: job.status,
      error: job.error,
      metadata: job.metadata,
      metrics: job.metrics,
    },
  } satisfies Record<string, unknown>;

  const { error } = await supabase.from('agent_learning_jobs').insert(payload);
  if (error) {
    throw new Error(`Impossible d'enregistrer le job d'évaluation: ${error.message}`);
  }
}

async function runRemoteEvaluation(
  supabase: SupabaseClient | null,
  options: CliOptions,
  datasetId: string,
  scenario: string,
): Promise<void> {
  if (options.dryRun) {
    const message = `Mode simulation: job OpenAI ignoré pour ${scenario} (dataset ${datasetId}).`;
    if (options.ciMode) {
      console.log(message);
    } else {
      ora().info(message);
    }
    return;
  }

  const agentId = serverEnv.OPENAI_EVAL_AGENT_ID;
  if (!agentId) {
    throw new Error('OPENAI_EVAL_AGENT_ID doit être défini pour déclencher les évaluations plateforme.');
  }

  const evalClient = createOpenAIEvalsClient();
  const submissionSpinner = options.ciMode
    ? null
    : ora(`Soumission du job OpenAI Evals (${scenario})...`).start();

  let finalJob: EvalJobResult | null = null;
  try {
    const metadata: Record<string, unknown> = {
      org_id: options.orgId,
      user_id: options.userId,
      scenario,
      triggered_from: options.ciMode ? 'ci' : 'manual',
    };

    const createdJob = await evalClient.createJob({
      datasetId,
      agentId,
      metadata,
      runName: `ops-eval-${scenario}-${Date.now()}`,
    });

    if (submissionSpinner) {
      submissionSpinner.text = `Job ${createdJob.id} soumis, attente des résultats...`;
    } else {
      console.log(`Job OpenAI Evals soumis (${createdJob.id}), attente des résultats...`);
    }

    finalJob = await evalClient.pollJob(createdJob.id);

    if (submissionSpinner) {
      if (finalJob.status === 'completed') {
        submissionSpinner.succeed(`Job ${finalJob.id} terminé (${scenario}).`);
      } else {
        submissionSpinner.fail(`Job ${finalJob.id} terminé avec statut ${finalJob.status}.`);
      }
    } else {
      console.log(`Job ${finalJob.id} terminé avec statut ${finalJob.status}.`);
    }
  } catch (error) {
    if (submissionSpinner) {
      submissionSpinner.fail('Soumission du job OpenAI Evals échouée.');
    }
    throw error;
  }

  if (!finalJob) {
    throw new Error('Job OpenAI Evals introuvable après soumission.');
  }

  await recordEvalJobLearningEntry(supabase, options.orgId, scenario, datasetId, finalJob);

  const thresholdResult = evaluateRemoteMetricsAgainstThresholds(finalJob.metrics);
  for (const failure of thresholdResult.failures) {
    console.error(`Seuil non respecté: ${failure}`);
  }

  console.log(
    `Précision allowlist P95: ${formatPercentage(finalJob.metrics.allowlistedCitationPrecisionP95)} | Validité temporelle P95: ${formatPercentage(
      finalJob.metrics.temporalValidityP95,
    )} | Bannière Maghreb: ${formatPercentage(finalJob.metrics.maghrebBannerCoverage)} | Rappel HITL haute criticité: ${formatPercentage(
      finalJob.metrics.hitlRecallHighRisk,
    )}`,
  );

  let linkHealthSummary: LinkHealthSummary | null = null;
  try {
    linkHealthSummary = await fetchLinkHealthSummary(supabase, options.orgId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(message);
  }

  const linkHealthCheck = checkLinkHealthThreshold(linkHealthSummary);
  if (!linkHealthCheck.ok) {
    const failure = linkHealthCheck.failure ?? 'Liens officiels hors seuil';
    console.error(`Seuil non respecté: ${failure}`);
    thresholdResult.failures.push(failure);
  }

  if (linkHealthSummary) {
    console.log(
      `Liens officiels contrôlés: ${linkHealthSummary.totalSources} (en échec: ${linkHealthSummary.failedSources}, stables: ${linkHealthSummary.staleSources})`,
    );
  }

  if (finalJob.status !== 'completed') {
    thresholdResult.failures.push(`Statut job ${finalJob.status}`);
  }
  if (finalJob.error) {
    thresholdResult.failures.push(`Erreur job: ${finalJob.error}`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    scenario,
    dataset_id: datasetId,
    job_id: finalJob.id,
    status: finalJob.status,
    error: finalJob.error,
    metrics: finalJob.metrics,
    threshold_failures: thresholdResult.failures,
    thresholds: {
      allowlisted_citation_precision_p95: ACCEPTANCE_THRESHOLDS.citationsAllowlistedP95,
      temporal_validity_p95: ACCEPTANCE_THRESHOLDS.temporalValidityP95,
      maghreb_banner_coverage: ACCEPTANCE_THRESHOLDS.maghrebBindingBannerCoverage,
      hitl_recall_high_risk: ACCEPTANCE_THRESHOLDS.hitlRecallHighRisk,
    },
    link_health: linkHealthSummary
      ? {
          total_sources: linkHealthSummary.totalSources,
          failed_sources: linkHealthSummary.failedSources,
          stale_sources: linkHealthSummary.staleSources,
          failure_ratio: linkHealthSummary.failureRatio,
        }
      : null,
  };

  const outputPath = path.resolve(process.cwd(), 'ops', 'reports', 'evaluation-summary.json');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (!options.ciMode) {
    console.log(`Tableau de bord enregistré dans ${outputPath}`);
  }

  let gatingFailed = finalJob.status !== 'completed' || finalJob.error != null || !thresholdResult.ok || !linkHealthCheck.ok;
  if (finalJob.error) {
    console.error(`Erreur job OpenAI Evals: ${finalJob.error}`);
  }

  const summary = gatingFailed
    ? `Évaluation ${scenario}: échec (job ${finalJob.id}).`
    : `Évaluation ${scenario}: succès (job ${finalJob.id}).`;

  if (gatingFailed) {
    if (options.ciMode) {
      console.error(summary);
    } else {
      ora().fail(summary);
    }
    process.exitCode = 1;
  } else if (options.ciMode) {
    console.log(summary);
  } else {
    ora().succeed(summary);
  }
}

function parseArgs(): CliOptions {
  const defaultOrg = process.env.EVAL_ORG_ID ?? '00000000-0000-0000-0000-000000000000';
  const defaultUser = process.env.EVAL_USER_ID ?? defaultOrg;
  const options: CliOptions = {
    orgId: defaultOrg,
    userId: defaultUser,
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
    limit: Number.POSITIVE_INFINITY,
    dryRun: false,
    ciMode: false,
    benchmark: process.env.EVAL_BENCHMARK ?? null,
  };

  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--org':
      case '-o':
        options.orgId = args[index + 1] ?? options.orgId;
        index += 1;
        break;
      case '--user':
      case '-u':
        options.userId = args[index + 1] ?? options.userId;
        index += 1;
        break;
      case '--api':
        options.apiBaseUrl = args[index + 1] ?? options.apiBaseUrl;
        index += 1;
        break;
      case '--limit':
      case '-l':
        options.limit = Number.parseInt(args[index + 1] ?? '', 10);
        if (!Number.isFinite(options.limit) || options.limit <= 0) {
          options.limit = Number.POSITIVE_INFINITY;
        }
        index += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--ci':
        options.ciMode = true;
        break;
      case '--benchmark':
        options.benchmark = args[index + 1] ?? null;
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

async function fetchEvalCases(
  supabase: SupabaseClient | null,
  orgId: string,
  limit: number,
  benchmark?: string | null,
) {
  if (benchmark) {
    const cases = await loadBenchmarkCases(benchmark);
    const scoped = Number.isFinite(limit) ? cases.slice(0, limit) : cases;
    return scoped;
  }

  if (!supabase) {
    const data = Number.isFinite(limit) ? FALLBACK_CASES.slice(0, limit) : FALLBACK_CASES;
    return data.map((entry) => ({
      id: entry.id,
      name: entry.name,
      prompt: entry.prompt,
      expected_contains: entry.expected_contains,
      benchmark: entry.benchmark ?? 'fallback',
    }));
  }

  const query = supabase
    .from('eval_cases')
    .select('id, name, prompt, expected_contains')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (Number.isFinite(limit)) {
    query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Impossible de récupérer les cas d'évaluation: ${error.message}`);
  }

  return (data ?? []).map((entry) => ({
    ...entry,
    benchmark: benchmark ?? null,
  }));
}

async function recordResult(
  supabase: SupabaseClient | null,
  caseId: string,
  runId: string | null,
  pass: boolean,
  notes: string | null,
  metrics?: CaseMetricsSummary,
  benchmark?: string | null,
) {
  if (!supabase) {
    return;
  }
  const payload: Record<string, unknown> = {
    case_id: caseId,
    run_id: runId,
    pass,
    notes,
  };

  if (metrics) {
    payload.metrics = {
      citation_precision: metrics.citationPrecision,
      temporal_validity: metrics.temporalValidity,
      binding_warnings: metrics.bindingWarnings,
      jurisdiction: metrics.jurisdiction,
      maghreb_banner: metrics.maghrebBanner,
      ...(benchmark ? { benchmark } : {}),
    };
    payload.citation_precision = metrics.citationPrecision;
    payload.temporal_validity = metrics.temporalValidity;
    payload.binding_warnings = metrics.bindingWarnings;
    payload.jurisdiction = metrics.jurisdiction;
    if (typeof metrics.maghrebBanner === 'boolean') {
      payload.maghreb_banner = metrics.maghrebBanner;
    }
  }

  if (benchmark && !metrics) {
    payload.metrics = { benchmark };
  }

  const { error } = await supabase.from('eval_results').insert(payload);

  if (error) {
    throw new Error(`Impossible d'enregistrer le résultat: ${error.message}`);
  }
}

async function run(): Promise<void> {
  const options = parseArgs();
  if (!options.orgId || !options.userId) {
    throw new Error('OrgId et userId doivent être renseignés (utilisez --org et --user).');
  }

  const env = loadRequiredEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  const hasSupabase = env.missing.length === 0;
  const supabase = hasSupabase ? createSupabaseService(env.values) : null;
  if (!hasSupabase) {
    console.warn('Supabase credentials missing: running evaluation in local fallback mode.');
  }
  const datasetMap = parseDatasetMapping();
  const scenario = normaliseScenarioName(options.benchmark ?? null);
  const datasetId = datasetMap[scenario] ?? datasetMap.default ?? null;

  if (datasetId) {
    await runRemoteEvaluation(supabase, options, datasetId, scenario);
    return;
  }

  const spinner = options.ciMode ? null : ora("Chargement des cas d'évaluation...").start();
  const cases = await fetchEvalCases(supabase, options.orgId, options.limit, options.benchmark ?? null);
  if (spinner) {
    spinner.succeed(`${cases.length} cas à évaluer pour l'organisation ${options.orgId}.`);
  } else {
    console.log(`Loaded ${cases.length} evaluation cases.`);
  }

  if (cases.length === 0) {
    return;
  }

  let passed = 0;
  let failed = 0;
  const scoreboard: Array<{
    caseId: string;
    name: string;
    pass: boolean;
    benchmark: string | null;
    metrics?: CaseMetricsSummary | null;
  }> = [];

  for (const evaluationCase of cases) {
    const caseSpinner = options.ciMode ? null : ora(`Évaluation: ${evaluationCase.name}`).start();
    if (options.dryRun) {
      if (caseSpinner) {
        caseSpinner.info('Mode simulation: exécution ignorée.');
      } else {
        console.log(`Skip (dry-run): ${evaluationCase.name}`);
      }
      continue;
    }

    const caseBenchmark =
      typeof (evaluationCase as Record<string, unknown>).benchmark === 'string'
        ? ((evaluationCase as Record<string, unknown>).benchmark as string)
        : options.benchmark ?? null;

    try {
      const response = await fetch(`${options.apiBaseUrl}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: evaluationCase.prompt,
          orgId: options.orgId,
          userId: options.userId,
        }),
      });

      if (!response.ok) {
        const message = `API ${response.status}`;
        await recordResult(supabase, evaluationCase.id as string, null, false, message, undefined, caseBenchmark);
        scoreboard.push({
          caseId: evaluationCase.id as string,
          name: evaluationCase.name as string,
          pass: false,
          benchmark: caseBenchmark,
          metrics: null,
        });
        if (caseSpinner) {
          caseSpinner.fail(`${evaluationCase.name}: ${message}`);
        } else {
          console.error(`${evaluationCase.name}: ${message}`);
        }
        failed += 1;
        continue;
      }

      const json = (await response.json()) as { runId?: string; data?: IRACPayload };
      const payload = json.data;
      if (!payload) {
        await recordResult(
          supabase,
          evaluationCase.id as string,
          json.runId ?? null,
          false,
          'Réponse vide',
          undefined,
          caseBenchmark,
        );
        scoreboard.push({
          caseId: evaluationCase.id as string,
          name: evaluationCase.name as string,
          pass: false,
          benchmark: caseBenchmark,
          metrics: null,
        });
        if (caseSpinner) {
          caseSpinner.fail(`${evaluationCase.name}: réponse vide`);
        } else {
          console.error(`${evaluationCase.name}: réponse vide`);
        }
        failed += 1;
        continue;
      }

      const expectedTerms = (evaluationCase.expected_contains as string[] | null) ?? [];
      const evaluation = evaluateExpectedTerms(payload, expectedTerms);
      const metrics = computeMetrics(payload);
      const notes = evaluation.pass ? null : `Manquants: ${evaluation.missing.join(', ')}`;
      await recordResult(
        supabase,
        evaluationCase.id as string,
        json.runId ?? null,
        evaluation.pass,
        notes,
        metrics,
        caseBenchmark,
      );
      scoreboard.push({
        caseId: evaluationCase.id as string,
        name: evaluationCase.name as string,
        pass: evaluation.pass,
        benchmark: caseBenchmark,
        metrics,
      });

      if (evaluation.pass) {
        if (caseSpinner) {
          caseSpinner.succeed(
            `${evaluationCase.name}: ✅ (Précision ${(metrics.citationPrecision * 100).toFixed(0)}% | Temporalité ${(metrics.temporalValidity * 100).toFixed(0)}%)`,
          );
        } else {
          console.log(
            `${evaluationCase.name}: PASS (precision ${(metrics.citationPrecision * 100).toFixed(0)}%, temporal ${(metrics.temporalValidity * 100).toFixed(0)}%)`,
          );
        }
        passed += 1;
      } else {
        const warning = `${evaluationCase.name}: attentes manquantes (${evaluation.missing.join(', ')})`;
        if (caseSpinner) {
          caseSpinner.warn(warning);
        } else {
          console.error(warning);
        }
        failed += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      await recordResult(
        supabase,
        evaluationCase.id as string,
        null,
        false,
        message,
        undefined,
        caseBenchmark,
      );
      scoreboard.push({
        caseId: evaluationCase.id as string,
        name: evaluationCase.name as string,
        pass: false,
        benchmark: caseBenchmark,
        metrics: null,
      });
      if (caseSpinner) {
        caseSpinner.fail(`${evaluationCase.name}: ${message}`);
      } else {
        console.error(`${evaluationCase.name}: ${message}`);
      }
      failed += 1;
    }
  }

  if (!options.dryRun) {
    let thresholdFailed = false;
    let thresholdFailures: string[] = [];
    let coverageSnapshot: {
      citationPrecision: number;
      temporalValidity: number;
      maghrebBanner: number;
    } | null = null;
    let linkHealthSummary: LinkHealthSummary | null = null;

    if (scoreboard.length > 0) {
      const aggregates = scoreboard.reduce(
        (acc, entry) => {
          if (entry.metrics) {
            acc.precisionSum += entry.metrics.citationPrecision;
            acc.temporalSum += entry.metrics.temporalValidity;
            acc.bindingWarnings += entry.metrics.bindingWarnings;
            acc.metricsCount += 1;
          }
          return acc;
        },
        { precisionSum: 0, temporalSum: 0, bindingWarnings: 0, metricsCount: 0 },
      );
      const metricsEntries = scoreboard
        .map((entry) => entry.metrics)
        .filter((entry): entry is CaseMetricsSummary => entry != null);
      const thresholdResult = checkAcceptanceThresholds(metricsEntries);
      thresholdFailed = !thresholdResult.ok;
      thresholdFailures = thresholdResult.failures;
      coverageSnapshot = thresholdResult.coverage;

      if (coverageSnapshot) {
        console.log(
          `Couverture précision >= ${(ACCEPTANCE_THRESHOLDS.citationsAllowlistedP95 * 100).toFixed(0)}%: ${(coverageSnapshot.citationPrecision * 100).toFixed(1)}%`,
        );
        console.log(
          `Couverture validité temporelle >= ${(ACCEPTANCE_THRESHOLDS.temporalValidityP95 * 100).toFixed(0)}%: ${(coverageSnapshot.temporalValidity * 100).toFixed(1)}%`,
        );
        console.log(
          `Couverture bannière Maghreb >= ${(ACCEPTANCE_THRESHOLDS.maghrebBindingBannerCoverage * 100).toFixed(0)}%: ${(coverageSnapshot.maghrebBanner * 100).toFixed(1)}%`,
        );
      }

      if (thresholdFailed) {
        for (const failure of thresholdFailures) {
          console.error(`Seuil non respecté: ${failure}`);
        }
        process.exitCode = 1;
      }

      try {
        linkHealthSummary = await fetchLinkHealthSummary(supabase, options.orgId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(message);
      }

      const linkHealthCheck = checkLinkHealthThreshold(linkHealthSummary);
      if (!linkHealthCheck.ok) {
        thresholdFailed = true;
        const linkFailure = linkHealthCheck.failure ?? 'Liens officiels hors seuil';
        thresholdFailures.push(linkFailure);
        console.error(`Seuil non respecté: ${linkFailure}`);
        process.exitCode = 1;
      }

      if (linkHealthSummary) {
        console.log(
          `Liens officiels contrôlés: ${linkHealthSummary.totalSources} (en échec: ${linkHealthSummary.failedSources}, stables: ${linkHealthSummary.staleSources})`,
        );
      }

      const report = {
        generated_at: new Date().toISOString(),
        total_cases: scoreboard.length,
        passed,
        failed,
        average_citation_precision:
          aggregates.metricsCount > 0 ? aggregates.precisionSum / aggregates.metricsCount : null,
        average_temporal_validity:
          aggregates.metricsCount > 0 ? aggregates.temporalSum / aggregates.metricsCount : null,
        total_binding_warnings: aggregates.bindingWarnings,
        coverage_citation_precision: coverageSnapshot?.citationPrecision ?? null,
        coverage_temporal_validity: coverageSnapshot?.temporalValidity ?? null,
        coverage_maghreb_banner: coverageSnapshot?.maghrebBanner ?? null,
        acceptance_failures: thresholdFailures,
        link_health: linkHealthSummary
          ? {
              total_sources: linkHealthSummary.totalSources,
              failed_sources: linkHealthSummary.failedSources,
              stale_sources: linkHealthSummary.staleSources,
              failure_ratio: linkHealthSummary.failureRatio,
            }
          : null,
        cases: scoreboard,
      };
      const outputPath = path.resolve(process.cwd(), 'ops', 'reports', 'evaluation-summary.json');
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      if (!options.ciMode) {
        console.log(`Tableau de bord enregistré dans ${outputPath}`);
      }
    }

    const summaryBase = `Résultats: ${passed} réussi(s), ${failed} échec(s).`;
    const summary = thresholdFailed ? `${summaryBase} (seuils non respectés)` : summaryBase;
    if (failed > 0 || thresholdFailed) {
      if (options.ciMode) {
        console.error(summary);
      } else {
        ora().warn(summary);
      }
      process.exitCode = 1;
    } else if (options.ciMode) {
      console.log(summary);
    } else {
      ora().succeed(summary);
    }
  }
}

const isMain = typeof process !== 'undefined' && process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isMain) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
