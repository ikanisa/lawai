#!/usr/bin/env node
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ora, { type Ora } from 'ora';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadRequiredEnv } from './lib/env.js';
import { createSupabaseService } from './lib/supabase.js';
import { evaluateExpectedTerms } from './lib/evaluation.js';
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

const MAGHREB_JURISDICTION_SET = new Set<string>(
  MAGHREB_JURISDICTIONS.map((code) => code.toUpperCase()),
);

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BENCHMARKS_DIR = path.resolve(CURRENT_DIR, '../fixtures/benchmarks');

export type EvaluationCaseDefinition = {
  id: string;
  name: string;
  prompt: string;
  expected_contains: string[];
  benchmark?: string | null;
};

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

export interface EvaluationResultRecord {
  caseId: string;
  runId: string | null;
  pass: boolean;
  notes: string | null;
  metrics?: CaseMetricsSummary;
  benchmark?: string | null;
}

export interface EvaluationDataSource {
  loadCases(orgId: string, limit: number, benchmark?: string | null): Promise<EvaluationCaseDefinition[]>;
  recordResult(record: EvaluationResultRecord): Promise<void>;
  loadLinkHealth(orgId: string): Promise<LinkHealthSummary | null>;
}

export interface EvaluationDependencies {
  dataSource: EvaluationDataSource;
  fetchImpl: typeof fetch;
  retries: number;
  retryDelayMs: number;
  logger: Pick<typeof console, 'log' | 'warn' | 'error'>;
  onProgress?: (payload: { index: number; total: number; name: string }) => void;
  onCaseResult?: (score: EvaluationCaseScore) => void;
  onRetry?: (payload: { attempt: number; caseId: string; error: unknown }) => void;
}

export interface EvaluationCaseScore {
  caseId: string;
  name: string;
  pass: boolean;
  benchmark: string | null;
  metrics?: CaseMetricsSummary | null;
  error?: string | null;
}

export interface EvaluationRunSummary {
  totalCases: number;
  passed: number;
  failed: number;
  scoreboard: EvaluationCaseScore[];
  errors: string[];
  coverageSnapshot: {
    citationPrecision: number;
    temporalValidity: number;
    maghrebBanner: number;
  } | null;
  thresholdFailures: string[];
  thresholdFailed: boolean;
  linkHealthSummary: LinkHealthSummary | null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function requestWithRetry(
  fetchImpl: typeof fetch,
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  attempts: number,
  delayMs: number,
  onRetry?: (attempt: number, error: unknown, response?: Response) => void,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(input, init);
      if (response.ok || response.status < 500 || attempt === attempts - 1) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
      onRetry?.(attempt + 1, lastError, response);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) {
        throw error;
      }
      onRetry?.(attempt + 1, error);
    }
    if (attempt < attempts - 1) {
      await delay(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Retry attempts exhausted');
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

export function createEvaluationDataSource(
  supabase: SupabaseClient | null,
): EvaluationDataSource {
  return {
    loadCases: (orgId, limit, benchmark) => fetchEvalCases(supabase, orgId, limit, benchmark),
    recordResult: (record) => recordResult(supabase, record),
    loadLinkHealth: (orgId) => fetchLinkHealthSummary(supabase, orgId),
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
): Promise<EvaluationCaseDefinition[]> {
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
  record: EvaluationResultRecord,
) {
  if (!supabase) {
    return;
  }
  const payload: Record<string, unknown> = {
    case_id: record.caseId,
    run_id: record.runId,
    pass: record.pass,
    notes: record.notes,
  };

  if (record.metrics) {
    payload.metrics = {
      citation_precision: record.metrics.citationPrecision,
      temporal_validity: record.metrics.temporalValidity,
      binding_warnings: record.metrics.bindingWarnings,
      jurisdiction: record.metrics.jurisdiction,
      maghreb_banner: record.metrics.maghrebBanner,
      ...(record.benchmark ? { benchmark: record.benchmark } : {}),
    };
    payload.citation_precision = record.metrics.citationPrecision;
    payload.temporal_validity = record.metrics.temporalValidity;
    payload.binding_warnings = record.metrics.bindingWarnings;
    payload.jurisdiction = record.metrics.jurisdiction;
    if (typeof record.metrics.maghrebBanner === 'boolean') {
      payload.maghreb_banner = record.metrics.maghrebBanner;
    }
  }

  if (record.benchmark && !record.metrics) {
    payload.metrics = { benchmark: record.benchmark };
  }

  const { error } = await supabase.from('eval_results').insert(payload);

  if (error) {
    throw new Error(`Impossible d'enregistrer le résultat: ${error.message}`);
  }
}

export async function runEvaluation(
  options: CliOptions,
  dependencies: EvaluationDependencies,
): Promise<EvaluationRunSummary> {
  if (!options.orgId || !options.userId) {
    throw new Error('OrgId et userId doivent être renseignés (utilisez --org et --user).');
  }

  const cases = await dependencies.dataSource.loadCases(
    options.orgId,
    options.limit,
    options.benchmark ?? null,
  );
  dependencies.onProgress?.({ index: 0, total: cases.length, name: '' });

  if (cases.length === 0) {
    return {
      totalCases: 0,
      passed: 0,
      failed: 0,
      scoreboard: [],
      errors: [],
      coverageSnapshot: null,
      thresholdFailures: [],
      thresholdFailed: false,
      linkHealthSummary: null,
    };
  }

  if (options.ciMode) {
    dependencies.logger.log(
      `${cases.length} cas à évaluer pour l'organisation ${options.orgId}.`,
    );
  }

  const scoreboard: EvaluationCaseScore[] = [];
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;
  const total = cases.length;

  for (let index = 0; index < total; index += 1) {
    const evaluationCase = cases[index];
    dependencies.onProgress?.({ index: index + 1, total, name: evaluationCase.name });

    if (options.dryRun) {
      continue;
    }

    const caseBenchmark =
      typeof (evaluationCase as Record<string, unknown>).benchmark === 'string'
        ? ((evaluationCase as Record<string, unknown>).benchmark as string)
        : options.benchmark ?? null;

    try {
      const response = await requestWithRetry(
        dependencies.fetchImpl,
        `${options.apiBaseUrl}/runs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: evaluationCase.prompt,
            orgId: options.orgId,
            userId: options.userId,
          }),
        },
        Math.max(1, dependencies.retries),
        Math.max(0, dependencies.retryDelayMs),
        (attempt, error) => {
          dependencies.onRetry?.({ attempt, caseId: evaluationCase.id, error });
        },
      );

      if (!response.ok) {
        const message = `API ${response.status}`;
        await dependencies.dataSource.recordResult({
          caseId: evaluationCase.id,
          runId: null,
          pass: false,
          notes: message,
          benchmark: caseBenchmark,
        });
        const score: EvaluationCaseScore = {
          caseId: evaluationCase.id,
          name: evaluationCase.name,
          pass: false,
          benchmark: caseBenchmark,
          metrics: null,
          error: message,
        };
        scoreboard.push(score);
        dependencies.onCaseResult?.(score);
        errors.push(`${evaluationCase.name}: ${message}`);
        failed += 1;
        continue;
      }

      const json = (await response.json()) as { runId?: string; data?: IRACPayload };
      const payload = json.data;
      if (!payload) {
        await dependencies.dataSource.recordResult({
          caseId: evaluationCase.id,
          runId: json.runId ?? null,
          pass: false,
          notes: 'Réponse vide',
          benchmark: caseBenchmark,
        });
        const score: EvaluationCaseScore = {
          caseId: evaluationCase.id,
          name: evaluationCase.name,
          pass: false,
          benchmark: caseBenchmark,
          metrics: null,
          error: 'Réponse vide',
        };
        scoreboard.push(score);
        dependencies.onCaseResult?.(score);
        errors.push(`${evaluationCase.name}: réponse vide`);
        failed += 1;
        continue;
      }

      const expectedTerms = evaluationCase.expected_contains ?? [];
      const evaluation = evaluateExpectedTerms(payload, expectedTerms);
      const metrics = computeMetrics(payload);
      const notes = evaluation.pass ? null : `Manquants: ${evaluation.missing.join(', ')}`;
      await dependencies.dataSource.recordResult({
        caseId: evaluationCase.id,
        runId: json.runId ?? null,
        pass: evaluation.pass,
        notes,
        metrics,
        benchmark: caseBenchmark,
      });
      const score: EvaluationCaseScore = {
        caseId: evaluationCase.id,
        name: evaluationCase.name,
        pass: evaluation.pass,
        benchmark: caseBenchmark,
        metrics,
        error: evaluation.pass ? null : notes,
      };
      scoreboard.push(score);
      dependencies.onCaseResult?.(score);

      if (evaluation.pass) {
        passed += 1;
      } else {
        errors.push(`${evaluationCase.name}: attentes manquantes (${evaluation.missing.join(', ')})`);
        failed += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      await dependencies.dataSource.recordResult({
        caseId: evaluationCase.id,
        runId: null,
        pass: false,
        notes: message,
        benchmark: caseBenchmark,
      });
      const score: EvaluationCaseScore = {
        caseId: evaluationCase.id,
        name: evaluationCase.name,
        pass: false,
        benchmark: caseBenchmark,
        metrics: null,
        error: message,
      };
      scoreboard.push(score);
      dependencies.onCaseResult?.(score);
      errors.push(`${evaluationCase.name}: ${message}`);
      failed += 1;
    }
  }

  if (options.dryRun) {
    return {
      totalCases: total,
      passed: 0,
      failed: 0,
      scoreboard,
      errors,
      coverageSnapshot: null,
      thresholdFailures: [],
      thresholdFailed: false,
      linkHealthSummary: null,
    };
  }

  let thresholdFailed = false;
  let thresholdFailures: string[] = [];
  let coverageSnapshot: {
    citationPrecision: number;
    temporalValidity: number;
    maghrebBanner: number;
  } | null = null;
  let linkHealthSummary: LinkHealthSummary | null = null;

  if (scoreboard.length > 0) {
    const metricsEntries = scoreboard
      .map((entry) => entry.metrics)
      .filter((entry): entry is CaseMetricsSummary => entry != null);
    const thresholdResult = checkAcceptanceThresholds(metricsEntries);
    thresholdFailed = !thresholdResult.ok;
    thresholdFailures = thresholdResult.failures;
    coverageSnapshot = thresholdResult.coverage;

    try {
      linkHealthSummary = await dependencies.dataSource.loadLinkHealth(options.orgId);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    const linkHealthCheck = checkLinkHealthThreshold(linkHealthSummary);
    if (!linkHealthCheck.ok) {
      thresholdFailed = true;
      const failureMessage = linkHealthCheck.failure ?? 'Liens officiels hors seuil';
      thresholdFailures.push(failureMessage);
    }
  }

  return {
    totalCases: total,
    passed,
    failed,
    scoreboard,
    errors,
    coverageSnapshot,
    thresholdFailures,
    thresholdFailed,
    linkHealthSummary,
  };
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

  let loadSpinner: ora.Ora | null = null;
  if (!options.ciMode) {
    loadSpinner = ora("Chargement des cas d'évaluation...").start();
  }

  let caseSpinner: ora.Ora | null = null;
  const summary = await runEvaluation(options, {
    dataSource: createEvaluationDataSource(supabase),
    fetchImpl: fetch,
    retries: 3,
    retryDelayMs: 5_000,
    logger: console,
    onProgress: ({ index, total, name }) => {
      if (index === 0) {
        if (loadSpinner) {
          loadSpinner.succeed(`${total} cas à évaluer pour l'organisation ${options.orgId}.`);
          loadSpinner = null;
        } else if (options.ciMode) {
          console.log(`${total} cas à évaluer pour l'organisation ${options.orgId}.`);
        }
        return;
      }
      if (options.ciMode) {
        console.log(`[${index}/${total}] ${name}`);
        return;
      }
      if (caseSpinner) {
        caseSpinner.stop();
      }
      caseSpinner = ora(`Évaluation (${index}/${total}) : ${name}`).start();
    },
    onCaseResult: (score) => {
      if (options.ciMode) {
        if (score.error) {
          console.error(`${score.name}: ${score.error}`);
        }
        return;
      }
      if (!caseSpinner) {
        caseSpinner = ora(score.name).start();
      }
      if (score.metrics && score.pass) {
        caseSpinner.succeed(
          `${score.name}: ✅ (Précision ${(score.metrics.citationPrecision * 100).toFixed(0)}% | Temporalité ${(score.metrics.temporalValidity * 100).toFixed(0)}%)`,
        );
      } else if (score.metrics && !score.pass) {
        caseSpinner.warn(`${score.name}: ${score.error ?? 'Attentes manquantes'}`);
      } else if (score.error) {
        caseSpinner.fail(`${score.name}: ${score.error}`);
      } else {
        caseSpinner.stop();
      }
    },
    onRetry: ({ attempt, caseId, error }) => {
      if (options.ciMode) {
        console.warn(`Nouvelle tentative (${attempt}) pour le cas ${caseId}: ${error}`);
      }
    },
  });

  if (summary.totalCases === 0) {
    if (loadSpinner) {
      loadSpinner.succeed('Aucun cas à évaluer.');
    }
    return;
  }

  if (summary.coverageSnapshot) {
    console.log(
      `Couverture précision >= ${(ACCEPTANCE_THRESHOLDS.citationsAllowlistedP95 * 100).toFixed(0)}%: ${(summary.coverageSnapshot.citationPrecision * 100).toFixed(1)}%`,
    );
    console.log(
      `Couverture validité temporelle >= ${(ACCEPTANCE_THRESHOLDS.temporalValidityP95 * 100).toFixed(0)}%: ${(summary.coverageSnapshot.temporalValidity * 100).toFixed(1)}%`,
    );
    console.log(
      `Couverture bannière Maghreb >= ${(ACCEPTANCE_THRESHOLDS.maghrebBindingBannerCoverage * 100).toFixed(0)}%: ${(summary.coverageSnapshot.maghrebBanner * 100).toFixed(1)}%`,
    );
  }

  if (summary.thresholdFailures.length > 0) {
    for (const failure of summary.thresholdFailures) {
      console.error(`Seuil non respecté: ${failure}`);
    }
    process.exitCode = 1;
  }

  if (summary.linkHealthSummary) {
    console.log(
      `Liens officiels contrôlés: ${summary.linkHealthSummary.totalSources} (en échec: ${summary.linkHealthSummary.failedSources}, stables: ${summary.linkHealthSummary.staleSources})`,
    );
  }

  if (summary.errors.length > 0 && options.ciMode) {
    for (const message of summary.errors) {
      console.error(message);
    }
  } else if (summary.errors.length > 0) {
    const warningSpinner = ora().warn('Certaines évaluations ont échoué.');
    warningSpinner.start();
    for (const message of summary.errors) {
      console.error(message);
    }
    warningSpinner.stop();
  }

  if (!options.dryRun && summary.scoreboard.length > 0) {
    const aggregates = summary.scoreboard.reduce(
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

    const report = {
      generated_at: new Date().toISOString(),
      total_cases: summary.scoreboard.length,
      passed: summary.passed,
      failed: summary.failed,
      average_citation_precision:
        aggregates.metricsCount > 0 ? aggregates.precisionSum / aggregates.metricsCount : null,
      average_temporal_validity:
        aggregates.metricsCount > 0 ? aggregates.temporalSum / aggregates.metricsCount : null,
      total_binding_warnings: aggregates.bindingWarnings,
      coverage_citation_precision: summary.coverageSnapshot?.citationPrecision ?? null,
      coverage_temporal_validity: summary.coverageSnapshot?.temporalValidity ?? null,
      coverage_maghreb_banner: summary.coverageSnapshot?.maghrebBanner ?? null,
      threshold_failures: summary.thresholdFailures,
      link_health: summary.linkHealthSummary
        ? {
            total_sources: summary.linkHealthSummary.totalSources,
            failed_sources: summary.linkHealthSummary.failedSources,
            stale_sources: summary.linkHealthSummary.staleSources,
            failure_ratio: summary.linkHealthSummary.failureRatio,
          }
        : null,
      cases: summary.scoreboard,
    };
    const outputPath = path.resolve(process.cwd(), 'ops', 'reports', 'evaluation-summary.json');
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    if (!options.ciMode) {
      console.log(`Tableau de bord enregistré dans ${outputPath}`);
    }
  }

  const summaryBase = `Résultats: ${summary.passed} réussi(s), ${summary.failed} échec(s).`;
  const summaryMessage = summary.thresholdFailed ? `${summaryBase} (seuils non respectés)` : summaryBase;
  if (summary.failed > 0 || summary.thresholdFailed) {
    if (options.ciMode) {
      console.error(summaryMessage);
    } else {
      ora().warn(summaryMessage);
    }
    process.exitCode = 1;
  } else if (options.ciMode) {
    console.log(summaryMessage);
  } else {
    ora().succeed(summaryMessage);
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
