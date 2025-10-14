/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';
import { CITATOR_FIXTURES, type CitatorFixture } from './citator-fixtures.ts';

type LearningJob = {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown> | null;
  org_id: string | null;
};

type Env = {
  supabaseUrl?: string;
  supabaseServiceRole?: string;
  orgId?: string;
  mode?: string;
};

type ReportResult = {
  orgId: string;
  drift?: { inserted: boolean };
  evaluation?: { inserted: boolean };
  fairness?: { inserted: boolean };
  queue?: { inserted: boolean };
  error?: string;
};

type SourceRow = {
  id: string;
  source_url: string;
  court_rank?: string | null;
  effective_date?: string | null;
};

function normaliseUrl(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    parsed.search = '';
    const normalised = parsed.toString().replace(/\/+$/, '');
    return normalised.toLowerCase();
  } catch (_error) {
    return trimmed.replace(/\/+$/, '').toLowerCase();
  }
}

function selectFixturesForOrg(fixtures: CitatorFixture[], urlSet: Set<string>, sinceIso?: string | null) {
  let since: Date | null = null;
  if (sinceIso) {
    const parsed = new Date(sinceIso);
    if (!Number.isNaN(parsed.getTime())) {
      since = parsed;
    }
  }

  return fixtures.filter((fixture) => {
    const cited = normaliseUrl(fixture.citedUrl);
    const citing = normaliseUrl(fixture.citingUrl);
    if (!cited || !citing) {
      return false;
    }
    if (!urlSet.has(cited) || !urlSet.has(citing)) {
      return false;
    }
    if (since && fixture.decidedAt) {
      const decided = new Date(fixture.decidedAt);
      if (!Number.isNaN(decided.getTime()) && decided < since) {
        return false;
      }
    }
    return true;
  });
}

const FAIRNESS_HITL_THRESHOLD = 0.2;
const FAIRNESS_HIGH_RISK_THRESHOLD = 0.25;
const FAIRNESS_BENCHMARK_THRESHOLD = 0.15;

function extractCountryCode(value: unknown): string | null {
  if (value && typeof value === 'object' && 'country' in (value as Record<string, unknown>)) {
    const country = (value as { country?: unknown }).country;
    return typeof country === 'string' && country.trim().length > 0 ? country : null;
  }
  return null;
}

function buildFairnessReport(
  runs: Array<{
    risk_level?: string | null;
    hitl_required?: boolean | null;
    jurisdiction_json?: unknown;
  }>,
  evaluations: Array<{
    pass?: boolean | null;
    metrics?: Record<string, unknown> | null;
  }>,
  windowStart: string,
  windowEnd: string,
): Record<string, unknown> | null {
  if (runs.length === 0 && evaluations.length === 0) {
    return null;
  }

  const jurisdictionMap = new Map<
    string,
    { total: number; hitl: number; highRisk: number }
  >();
  let totalRuns = 0;
  let totalHitl = 0;
  let totalHighRisk = 0;

  for (const run of runs) {
    const code = extractCountryCode(run.jurisdiction_json) ?? 'UNK';
    const bucket = jurisdictionMap.get(code) ?? { total: 0, hitl: 0, highRisk: 0 };
    bucket.total += 1;
    totalRuns += 1;
    if (run.hitl_required) {
      bucket.hitl += 1;
      totalHitl += 1;
    }
    const level = typeof run.risk_level === 'string' ? run.risk_level.toUpperCase() : null;
    if (level === 'HIGH') {
      bucket.highRisk += 1;
      totalHighRisk += 1;
    }
    jurisdictionMap.set(code, bucket);
  }

  const jurisdictions = Array.from(jurisdictionMap.entries()).map(([code, value]) => {
    const hitlRate = value.total > 0 ? value.hitl / value.total : null;
    const highRiskShare = value.total > 0 ? value.highRisk / value.total : null;
    return {
      code,
      totalRuns: value.total,
      hitlEscalations: value.hitl,
      hitlRate,
      highRiskShare,
    };
  });

  const overallHitlRate = totalRuns > 0 ? totalHitl / totalRuns : null;
  const overallHighRiskShare = totalRuns > 0 ? totalHighRisk / totalRuns : null;

  const flaggedJurisdictions = jurisdictions
    .filter((entry) => {
      const hitlDeviation =
        entry.hitlRate !== null && overallHitlRate !== null
          ? Math.abs(entry.hitlRate - overallHitlRate)
          : 0;
      const highRiskDeviation =
        entry.highRiskShare !== null && overallHighRiskShare !== null
          ? Math.abs(entry.highRiskShare - overallHighRiskShare)
          : 0;
      return (
        hitlDeviation >= FAIRNESS_HITL_THRESHOLD ||
        highRiskDeviation >= FAIRNESS_HIGH_RISK_THRESHOLD
      );
    })
    .map((entry) => entry.code);

  const benchmarkMap = new Map<string, { total: number; pass: number }>();
  let benchmarkTotal = 0;
  let benchmarkPass = 0;

  for (const record of evaluations) {
    if (!record.metrics || typeof record.metrics !== 'object') {
      continue;
    }
    const benchmark = record.metrics.benchmark;
    if (typeof benchmark !== 'string' || benchmark.trim().length === 0) {
      continue;
    }
    const stats = benchmarkMap.get(benchmark) ?? { total: 0, pass: 0 };
    stats.total += 1;
    benchmarkTotal += 1;
    if (record.pass === true) {
      stats.pass += 1;
      benchmarkPass += 1;
    }
    benchmarkMap.set(benchmark, stats);
  }

  const overallBenchmarkRate = benchmarkTotal > 0 ? benchmarkPass / benchmarkTotal : null;
  const benchmarks = Array.from(benchmarkMap.entries()).map(([name, stats]) => ({
    name,
    evaluated: stats.total,
    passRate: stats.total > 0 ? stats.pass / stats.total : null,
  }));
  const flaggedBenchmarks = benchmarks
    .filter((entry) => {
      if (entry.passRate === null || overallBenchmarkRate === null) {
        return false;
      }
      return Math.abs(entry.passRate - overallBenchmarkRate) >= FAIRNESS_BENCHMARK_THRESHOLD;
    })
    .map((entry) => entry.name);

  return {
    windowStart,
    windowEnd,
    capturedAt: windowEnd,
    overall: {
      totalRuns,
      hitlRate: overallHitlRate,
      highRiskShare: overallHighRiskShare,
      benchmarkRate: overallBenchmarkRate,
    },
    jurisdictions,
    benchmarks,
    flagged: {
      jurisdictions: flaggedJurisdictions,
      benchmarks: flaggedBenchmarks,
    },
  };
}

async function listOrganisationIds(
  client: ReturnType<typeof createClient>,
  orgId?: string,
): Promise<string[]> {
  if (orgId) {
    return [orgId];
  }
  const { data, error } = await client.from('organizations').select('id');
  if (error) {
    console.warn('Impossible de lister les organisations:', error.message);
    return [];
  }
  return (data ?? []).map((row) => row.id as string);
}

async function nextPendingJobs(client: ReturnType<typeof createClient>, limit: number, orgId?: string) {
  let query = client
    .from('agent_learning_jobs')
    .select('id, type, status, payload, org_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Impossible de récupérer les jobs: ${error.message}`);
  }
  return (data ?? []) as LearningJob[];
}

async function markStatus(
  client: ReturnType<typeof createClient>,
  jobId: string,
  status: string,
  errorMessage?: string | null,
) {
  const patch: Record<string, unknown> = { status };
  if (status === 'completed' || status === 'failed') {
    patch.completed_at = new Date().toISOString();
  }
  if (errorMessage) {
    patch.error = errorMessage;
  }

  const { error } = await client.from('agent_learning_jobs').update(patch).eq('id', jobId);

  if (error) {
    console.warn(`Impossible de mettre à jour le job ${jobId}:`, error.message);
  }
}

function validateJob(job: LearningJob): boolean {
  if (!job.payload || typeof job.payload !== 'object') {
    return false;
  }
  return true;
}

function normaliseTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function extractJurisdictionFromPayload(payload: Record<string, unknown> | null): string | null {
  if (!payload) {
    return null;
  }
  const routing = payload.routing as { primary?: { country?: string } } | undefined;
  if (routing?.primary?.country && typeof routing.primary.country === 'string') {
    return routing.primary.country;
  }
  const candidates = payload.detectedCandidates as Array<{ country?: string }> | undefined;
  if (Array.isArray(candidates)) {
    const candidate = candidates.find((entry) => typeof entry.country === 'string');
    if (candidate?.country) {
      return candidate.country;
    }
  }
  return null;
}

function extractSynonymTerms(question: string): string[] {
  const tokens = question
    .toLowerCase()
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((token) => token.length >= 5);
  const unique = new Set<string>();
  for (const token of tokens) {
    unique.add(token);
    unique.add(normaliseTerm(token));
  }
  return Array.from(unique);
}

async function handleIndexingTicket(client: ReturnType<typeof createClient>, job: LearningJob) {
  const payload = job.payload ?? {};
  const orgId = job.org_id;
  const question = typeof payload.question === 'string' ? payload.question : 'Question non renseignée';
  const note = typeof payload.note === 'string' ? payload.note : 'Indexation manuelle requise.';
  if (!orgId) {
    await markStatus(client, job.id, 'failed', 'missing_org');
    return;
  }

  const insert = await client
    .from('agent_task_queue')
    .insert({
      type: 'indexing_review',
      org_id: orgId,
      priority: 5,
      payload: {
        question,
        note,
      },
    });

  if (insert.error) {
    await markStatus(client, job.id, 'failed', insert.error.message);
    return;
  }

  await markStatus(client, job.id, 'completed');
}

async function handleQueryRewriteTicket(client: ReturnType<typeof createClient>, job: LearningJob) {
  if (!validateJob(job)) {
    await markStatus(client, job.id, 'failed', 'payload_invalid');
    return;
  }

  const payload = job.payload ?? {};
  const question = typeof payload.question === 'string' ? payload.question : null;
  if (!question) {
    await markStatus(client, job.id, 'failed', 'question_missing');
    return;
  }

  const jurisdiction = extractJurisdictionFromPayload(payload) ?? 'GLOBAL';
  const terms = extractSynonymTerms(question);

  if (terms.length === 0) {
    await markStatus(client, job.id, 'completed');
    return;
  }

  const expansions = terms.map((term) => normaliseTerm(term)).filter((value) => value.length > 0);

  for (const term of terms) {
    const { error } = await client
      .from('agent_synonyms')
      .upsert(
        {
          jurisdiction,
          term,
          expansions,
        },
        { onConflict: 'jurisdiction,term' },
      );
    if (error) {
      await markStatus(client, job.id, 'failed', error.message);
      return;
    }
  }

  await markStatus(client, job.id, 'completed');
}

async function handleGuardrailTicket(client: ReturnType<typeof createClient>, job: LearningJob) {
  const orgId = job.org_id;
  if (!orgId) {
    await markStatus(client, job.id, 'failed', 'missing_org');
    return;
  }

  const payload = job.payload ?? {};
  const reason = typeof payload.reason === 'string' ? payload.reason : 'Ajustement de guardrail requis.';

  const insert = await client
    .from('agent_task_queue')
    .insert({
      type: 'guardrail_review',
      org_id: orgId,
      priority: 4,
      payload: {
        reason,
        question: payload.question ?? null,
      },
    });

  if (insert.error) {
    await markStatus(client, job.id, 'failed', insert.error.message);
    return;
  }

  const policyName = typeof payload.policy === 'string' && payload.policy.length > 0 ? payload.policy : 'guardrail_adjustment';
  const policyInsert = await client.from('agent_policy_versions').insert({
    name: policyName,
    notes: reason,
    activated_at: new Date().toISOString(),
  });
  if (policyInsert.error) {
    console.warn('Impossible de journaliser la version de politique:', policyInsert.error.message);
  }

  await markStatus(client, job.id, 'completed');
}

async function handleReviewFeedbackTicket(client: ReturnType<typeof createClient>, job: LearningJob) {
  const orgId = job.org_id;
  if (!orgId) {
    await markStatus(client, job.id, 'failed', 'missing_org');
    return;
  }

  const payload = job.payload ?? {};
  const runId = typeof payload.runId === 'string' ? payload.runId : null;
  const hitlId = typeof payload.hitlId === 'string' ? payload.hitlId : job.id;
  const action = typeof payload.action === 'string' ? payload.action : 'review_feedback';
  const reviewerId = typeof payload.reviewerId === 'string' ? payload.reviewerId : null;
  const comment = typeof payload.comment === 'string' ? payload.comment : null;
  const resolutionMinutes =
    typeof payload.resolutionMinutes === 'number' ? payload.resolutionMinutes : null;

  const insert = await client.from('agent_task_queue').insert({
    type: 'review_feedback',
    org_id: orgId,
    priority: 3,
    payload: {
      runId,
      hitlId,
      action,
      reviewerId,
      comment,
      resolutionMinutes,
    },
  });

  if (insert.error) {
    await markStatus(client, job.id, 'failed', insert.error.message);
    return;
  }

  await markStatus(client, job.id, 'completed');
}

async function handleTreatmentGraphJob(client: ReturnType<typeof createClient>, job: LearningJob) {
  const orgId = job.org_id;
  if (!orgId) {
    await markStatus(client, job.id, 'failed', 'missing_org');
    return;
  }

  const payload = job.payload ?? {};
  const since = typeof (payload as { since?: unknown }).since === 'string' ? (payload as { since?: string }).since : null;

  const { data: sources, error } = await client
    .from('sources')
    .select('id, source_url, court_rank, effective_date, source_type')
    .eq('org_id', orgId)
    .eq('source_type', 'case');

  if (error) {
    await markStatus(client, job.id, 'failed', error.message);
    return;
  }

  const sourceMap = new Map<string, SourceRow>();
  for (const row of sources ?? []) {
    const key = normaliseUrl(row.source_url);
    if (!key) {
      continue;
    }
    sourceMap.set(key, {
      id: row.id as string,
      source_url: row.source_url as string,
      court_rank: typeof row.court_rank === 'string' ? row.court_rank : null,
      effective_date: typeof row.effective_date === 'string' ? row.effective_date : null,
    });
  }

  if (sourceMap.size === 0) {
    await markStatus(client, job.id, 'completed');
    return;
  }

  const fixtures = selectFixturesForOrg(CITATOR_FIXTURES, new Set(sourceMap.keys()), since);

  if (fixtures.length === 0) {
    await markStatus(client, job.id, 'completed');
    return;
  }

  const rows: Array<{
    org_id: string;
    source_id: string;
    citing_source_id: string;
    treatment: string;
    weight: number;
    decided_at: string | null;
    court_rank: string | null;
  }> = [];
  const targetSourceIds = new Set<string>();

  for (const fixture of fixtures) {
    const cited = sourceMap.get(normaliseUrl(fixture.citedUrl) ?? '');
    const citing = sourceMap.get(normaliseUrl(fixture.citingUrl) ?? '');
    if (!cited || !citing) {
      continue;
    }
    const decidedAt = fixture.decidedAt ?? citing.effective_date ?? null;
    rows.push({
      org_id: orgId,
      source_id: cited.id,
      citing_source_id: citing.id,
      treatment: fixture.treatment,
      weight: typeof fixture.weight === 'number' ? fixture.weight : 1,
      decided_at: decidedAt,
      court_rank: citing.court_rank ?? null,
    });
    targetSourceIds.add(cited.id);
  }

  if (rows.length === 0) {
    await markStatus(client, job.id, 'completed');
    return;
  }

  try {
    const ids = Array.from(targetSourceIds);
    if (ids.length > 0) {
      await client.from('case_treatments').delete().eq('org_id', orgId).in('source_id', ids);
    }
    const { error: insertError } = await client.from('case_treatments').insert(rows);
    if (insertError) {
      await markStatus(client, job.id, 'failed', insertError.message);
      return;
    }
    await markStatus(client, job.id, 'completed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markStatus(client, job.id, 'failed', message);
  }
}

async function enqueueTreatmentGraphJobs(client: ReturnType<typeof createClient>, orgId?: string) {
  const organisations = await listOrganisationIds(client, orgId);
  if (organisations.length === 0) {
    return;
  }

  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  for (const org of organisations) {
    const existing = await client
      .from('agent_learning_jobs')
      .select('id')
      .eq('org_id', org)
      .eq('type', 'treatment_graph_rebuild')
      .in('status', ['pending', 'processing'])
      .limit(1);

    if (existing.error) {
      console.warn(`Unable to inspect treatment jobs for ${org}:`, existing.error.message);
      continue;
    }

    if (Array.isArray(existing.data) && existing.data.length > 0) {
      continue;
    }

    const insert = await client.from('agent_learning_jobs').insert({
      org_id: org,
      type: 'treatment_graph_rebuild',
      status: 'pending',
      payload: { since: sinceIso },
    });

    if (insert.error) {
      console.warn(`Unable to enqueue treatment graph job for ${org}:`, insert.error.message);
    }
  }
}

async function upsertLearningReport(
  client: ReturnType<typeof createClient>,
  orgId: string,
  kind: 'drift' | 'evaluation' | 'queue' | 'fairness',
  reportDate: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await client
    .from('agent_learning_reports')
    .upsert(
      {
        org_id: orgId,
        kind,
        report_date: reportDate,
        payload,
      },
      { onConflict: 'org_id,kind,report_date' },
    );

  if (error) {
    console.warn(`Impossible d'enregistrer le rapport ${kind} pour ${orgId}:`, error.message);
    return false;
  }
  return true;
}

async function generateNightlyReports(
  client: ReturnType<typeof createClient>,
  orgId?: string,
): Promise<ReportResult[]> {
  const organisations = await listOrganisationIds(client, orgId);
  if (organisations.length === 0) {
    return [];
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();
  const nowIso = new Date().toISOString();
  const reportDate = nowIso.slice(0, 10);
  const results: ReportResult[] = [];

  for (const org of organisations) {
    const entry: ReportResult = { orgId: org };
    try {
      const runsQuery = await client
        .from('agent_runs')
        .select('id, risk_level, hitl_required, jurisdiction_json')
        .eq('org_id', org)
        .gte('started_at', sinceIso);

      if (runsQuery.error) {
        throw new Error(runsQuery.error.message);
      }

      const runs = runsQuery.data ?? [];
      const runIds = runs.map((row) => row.id as string);
      let allowlistedRatio: number | null = null;

      if (runIds.length > 0) {
        const citations = await client
          .from('run_citations')
          .select('run_id, domain_ok')
          .in('run_id', runIds);
        if (citations.error) {
          throw new Error(citations.error.message);
        }
        const entries = citations.data ?? [];
        if (entries.length > 0) {
          const okCount = entries.filter((row) => Boolean(row.domain_ok)).length;
          allowlistedRatio = okCount / entries.length;
        }
      }

      const driftPayload = {
        totalRuns: runs.length,
        highRiskRuns: runs.filter((row) => row.risk_level === 'HIGH').length,
        hitlEscalations: runs.filter((row) => row.hitl_required).length,
        allowlistedRatio,
      };
      entry.drift = { inserted: await upsertLearningReport(client, org, 'drift', reportDate, driftPayload) };

      const evalCases = await client.from('eval_cases').select('id').eq('org_id', org);
      if (evalCases.error) {
        throw new Error(evalCases.error.message);
      }
      const caseIds = (evalCases.data ?? []).map((row) => row.id as string);
      let evaluationRecords: Array<{ pass?: boolean | null; metrics?: Record<string, unknown> | null }> = [];
      if (caseIds.length > 0) {
        const evalResults = await client
          .from('eval_results')
          .select('pass, metrics')
          .in('case_id', caseIds)
          .gte('created_at', sinceIso);
        if (evalResults.error) {
          throw new Error(evalResults.error.message);
        }
        const records = evalResults.data ?? [];
        evaluationRecords = records as Array<{
          pass?: boolean | null;
          metrics?: Record<string, unknown> | null;
        }>;
        const passes = records.filter((row) => row.pass === true).length;
        const evaluationPayload = {
          evaluated: records.length,
          passCount: passes,
          passRate: records.length > 0 ? passes / records.length : null,
        };
        entry.evaluation = {
          inserted: await upsertLearningReport(client, org, 'evaluation', reportDate, evaluationPayload),
        };
      }

      const fairnessPayload = buildFairnessReport(runs, evaluationRecords, sinceIso, nowIso);

      if (fairnessPayload) {
        entry.fairness = {
          inserted: await upsertLearningReport(client, org, 'fairness', reportDate, fairnessPayload),
        };
      }
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
      console.warn(`Rapport nocturne échoué pour ${org}:`, entry.error);
    }
    results.push(entry);
  }

  return results;
}

async function generateQueueSnapshots(
  client: ReturnType<typeof createClient>,
  orgId?: string,
): Promise<ReportResult[]> {
  const organisations = await listOrganisationIds(client, orgId);
  if (organisations.length === 0) {
    return [];
  }

  const reportDate = new Date().toISOString().slice(0, 10);
  const results: ReportResult[] = [];

  for (const org of organisations) {
    const entry: ReportResult = { orgId: org };
    try {
      const pending = await client
        .from('agent_learning_jobs')
        .select('type, created_at')
        .eq('status', 'pending')
        .eq('org_id', org);

      if (pending.error) {
        throw new Error(pending.error.message);
      }

      const records = pending.data ?? [];
      const typeCounts: Record<string, number> = {};
      let oldest: string | null = null;

      for (const record of records) {
        const type = typeof record.type === 'string' && record.type.length > 0 ? record.type : 'unknown';
        typeCounts[type] = (typeCounts[type] ?? 0) + 1;
        const created = typeof record.created_at === 'string' ? record.created_at : null;
        if (created) {
          if (!oldest || new Date(created).getTime() < new Date(oldest).getTime()) {
            oldest = created;
          }
        }
      }

      const payload = {
        pending: records.length,
        byType: typeCounts,
        oldestCreatedAt: oldest,
        capturedAt: new Date().toISOString(),
      };

      entry.queue = {
        inserted: await upsertLearningReport(client, org, 'queue', reportDate, payload),
      };
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
      console.warn(`Impossible de créer le snapshot de file pour ${org}:`, entry.error);
    }
    results.push(entry);
  }

  return results;
}

async function processJob(client: ReturnType<typeof createClient>, job: LearningJob) {
  if (!validateJob(job)) {
    await markStatus(client, job.id, 'failed', 'payload_invalid');
    return;
  }

  switch (job.type) {
    case 'indexing_ticket':
      await handleIndexingTicket(client, job);
      break;
    case 'query_rewrite_ticket':
      await handleQueryRewriteTicket(client, job);
      break;
    case 'guardrail_tune_ticket':
      await handleGuardrailTicket(client, job);
      break;
    case 'review_feedback_ticket':
      await handleReviewFeedbackTicket(client, job);
      break;
    case 'treatment_graph_rebuild':
      await handleTreatmentGraphJob(client, job);
      break;
    default:
      await markStatus(client, job.id, 'completed');
      break;
  }
}

Deno.serve(async (req) => {
  const payload: Env = {};
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body === 'object') {
      Object.assign(payload, body as Env);
    }
  }

  const url = new URL(req.url);
  if (!payload.orgId && url.searchParams.has('orgId')) {
    payload.orgId = url.searchParams.get('orgId') ?? undefined;
  }
  if (!payload.mode && url.searchParams.has('mode')) {
    payload.mode = url.searchParams.get('mode') ?? undefined;
  }

  const supabaseUrl = payload.supabaseUrl ?? Deno.env.get('SUPABASE_URL');
  const supabaseServiceRole =
    payload.supabaseServiceRole ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE');

  if (!supabaseUrl || !supabaseServiceRole) {
    return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRole);

  const resolvedMode =
    payload.mode ??
    Deno.env.get('LEARNING_DEFAULT_MODE') ??
    (req.method === 'POST' ? 'hourly' : 'hourly');

  const processed: string[] = [];
  const lowerMode = resolvedMode.toLowerCase();
  const shouldProcessJobs = lowerMode !== 'reports';
  const shouldGenerateReports = lowerMode === 'nightly' || lowerMode === 'reports';
  const shouldCaptureQueue = lowerMode === 'hourly' || lowerMode === 'nightly';

  const orgId = payload.orgId ?? Deno.env.get('LEARNING_ORG_ID') ?? undefined;

  if (lowerMode === 'nightly') {
    await enqueueTreatmentGraphJobs(supabase, orgId);
  }

  if (shouldProcessJobs) {
    const jobs = await nextPendingJobs(supabase, 25, orgId);
    for (const job of jobs) {
      await markStatus(supabase, job.id, 'processing');
      await processJob(supabase, job);
      processed.push(job.id);
    }
  }

  const reports = shouldGenerateReports ? await generateNightlyReports(supabase, orgId) : [];
  const queue = shouldCaptureQueue ? await generateQueueSnapshots(supabase, orgId) : [];

  return new Response(JSON.stringify({ processed, reports, queue }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
