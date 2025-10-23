import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from '../../workspace.js';

const extractCountry = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if ('country' in value && typeof (value as { country?: unknown }).country === 'string') {
    const candidate = (value as { country?: string }).country;
    return candidate && candidate.trim().length > 0 ? candidate : null;
  }
  if ('country_code' in value && typeof (value as { country_code?: unknown }).country_code === 'string') {
    const candidate = (value as { country_code?: string }).country_code;
    return candidate && candidate.trim().length > 0 ? candidate : null;
  }
  return null;
};

export interface WorkspaceOverview {
  jurisdictions: Array<{ code: string; name: string; eu: boolean; ohada: boolean; matterCount: number }>;
  matters: Array<{
    id: string;
    question: string;
    status: string | null;
    riskLevel: string | null;
    hitlRequired: boolean | null;
    startedAt: string | null;
    finishedAt: string | null;
    jurisdiction: string | null;
  }>;
  complianceWatch: Array<{
    id: string;
    title: string;
    publisher: string | null;
    url: string;
    jurisdiction: string | null;
    consolidated: boolean | null;
    effectiveDate: string | null;
    createdAt: string | null;
  }>;
  hitlInbox: {
    items: Array<{ id: string; runId: string; reason: string; status: string; createdAt: string | null }>;
    pendingCount: number;
  };
  desk: ReturnType<typeof buildPhaseCWorkspaceDesk>;
  navigator: ReturnType<typeof buildPhaseCProcessNavigator>;
}

export interface WorkspaceFetchErrors {
  jurisdictions?: unknown;
  matters?: unknown;
  compliance?: unknown;
  hitl?: unknown;
}

export async function fetchWorkspaceOverview(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ data: WorkspaceOverview; errors: WorkspaceFetchErrors }> {
  const [jurisdictionsResult, mattersResult, complianceResult, hitlResult] = await Promise.all([
    supabase.from('jurisdictions').select('code, name, eu, ohada').order('name', { ascending: true }),
    supabase
      .from('agent_runs')
      .select('id, question, risk_level, hitl_required, status, started_at, finished_at, jurisdiction_json')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(8),
    supabase
      .from('sources')
      .select('id, title, publisher, source_url, jurisdiction_code, consolidated, effective_date, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('hitl_queue')
      .select('id, run_id, reason, status, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const jurisdictionRows = jurisdictionsResult.data ?? [];
  const matterRows = mattersResult.data ?? [];
  const complianceRows = complianceResult.data ?? [];
  const hitlRows = hitlResult.data ?? [];

  const matterCounts = new Map<string, number>();
  for (const row of matterRows) {
    const jurisdiction = extractCountry(row.jurisdiction_json);
    const key = jurisdiction ?? 'UNK';
    matterCounts.set(key, (matterCounts.get(key) ?? 0) + 1);
  }

  const jurisdictions = jurisdictionRows.map((row) => ({
    code: row.code,
    name: row.name,
    eu: row.eu,
    ohada: row.ohada,
    matterCount: matterCounts.get(row.code) ?? 0,
  }));

  const matters = matterRows.map((row) => ({
    id: row.id,
    question: row.question,
    status: row.status,
    riskLevel: row.risk_level,
    hitlRequired: row.hitl_required,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    jurisdiction: extractCountry(row.jurisdiction_json),
  }));

  const complianceWatch = complianceRows.map((row) => ({
    id: row.id,
    title: row.title,
    publisher: row.publisher,
    url: row.source_url,
    jurisdiction: row.jurisdiction_code,
    consolidated: row.consolidated,
    effectiveDate: row.effective_date,
    createdAt: row.created_at,
  }));

  const hitlItems = hitlRows.map((row) => ({
    id: row.id,
    runId: row.run_id,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
  }));

  const pendingCount = hitlItems.filter((item) => item.status === 'pending').length;

  return {
    data: {
      jurisdictions,
      matters,
      complianceWatch,
      hitlInbox: {
        items: hitlItems,
        pendingCount,
      },
      desk: buildPhaseCWorkspaceDesk(),
      navigator: buildPhaseCProcessNavigator(),
    },
    errors: {
      jurisdictions: jurisdictionsResult.error ?? undefined,
      matters: mattersResult.error ?? undefined,
      compliance: complianceResult.error ?? undefined,
      hitl: hitlResult.error ?? undefined,
    },
  };
}

export interface WorkspaceCitationsResponse {
  entries: Array<{
    id: string;
    title: string;
    sourceType: string | null;
    jurisdiction: string | null;
    url: string | null;
    publisher: string | null;
    bindingLanguage: string | null;
    consolidated: boolean | null;
    languageNote: string | null;
    effectiveDate: string | null;
    capturedAt: string | null;
    checksum: string | null;
  }>;
}

export async function fetchWorkspaceCitations(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ data: WorkspaceCitationsResponse; error?: unknown }> {
  const { data, error } = await supabase
    .from('sources')
    .select(
      'id, title, source_type, jurisdiction_code, source_url, publisher, binding_lang, consolidated, language_note, effective_date, created_at, capture_sha256',
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);

  const entries = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    jurisdiction: row.jurisdiction_code,
    url: row.source_url,
    publisher: row.publisher,
    bindingLanguage: row.binding_lang,
    consolidated: row.consolidated,
    languageNote: row.language_note,
    effectiveDate: row.effective_date,
    capturedAt: row.created_at,
    checksum: row.capture_sha256,
  }));

  return { data: { entries }, error: error ?? undefined };
}

export interface WorkspaceCaseScoresResponse {
  scores: Array<{
    id: string;
    sourceId: string;
    jurisdiction: string | null;
    score: number | null;
    axes: unknown;
    hardBlock: boolean | null;
    version: string | null;
    modelRef: string | null;
    notes: string | null;
    computedAt: string | null;
    source:
      | {
          title: string | null;
          url: string | null;
          trustTier: string | null;
          courtRank: string | null;
        }
      | null;
  }>;
}

export async function fetchWorkspaceCaseScores(
  supabase: SupabaseClient,
  orgId: string,
  sourceId?: string,
): Promise<{ data: WorkspaceCaseScoresResponse; error?: unknown }> {
  const query = supabase
    .from('case_scores')
    .select(
      'id, source_id, juris_code, score_overall, axes, hard_block, version, model_ref, notes, computed_at, sources(title, source_url, trust_tier, court_rank)',
    )
    .eq('org_id', orgId)
    .order('computed_at', { ascending: false })
    .limit(50);

  if (sourceId) {
    query.eq('source_id', sourceId);
  }

  const { data, error } = await query;

  const scores = (data ?? []).map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    jurisdiction: row.juris_code,
    score: row.score_overall,
    axes: row.axes,
    hardBlock: row.hard_block,
    version: row.version,
    modelRef: row.model_ref,
    notes: row.notes,
    computedAt: row.computed_at,
    source: row.sources
      ? {
          title: row.sources.title ?? null,
          url: row.sources.source_url ?? null,
          trustTier: row.sources.trust_tier ?? null,
          courtRank: row.sources.court_rank ?? null,
        }
      : null,
  }));

  return { data: { scores }, error: error ?? undefined };
}
