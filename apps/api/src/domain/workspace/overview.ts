import type { PostgrestSingleResponse, SupabaseClient } from '@supabase/supabase-js';

import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from './navigator.js';
import { buildHitlInbox, HITL_OVERVIEW_FIELDS, type HitlInbox, type HitlQueueRow, type HitlQueryResult } from './hitl.js';

export interface JurisdictionRow {
  code: string;
  name: string;
  eu: boolean;
  ohada: boolean;
}

export interface MatterRow {
  id: string;
  question: string;
  risk_level: string | null;
  hitl_required: boolean | null;
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
  jurisdiction_json: unknown;
}

export interface ComplianceRow {
  id: string;
  title: string;
  publisher: string | null;
  source_url: string;
  jurisdiction_code: string | null;
  consolidated: boolean | null;
  effective_date: string | null;
  created_at: string | null;
}

export interface WorkspaceOverviewCore {
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
  hitlInbox: HitlInbox;
}

export interface WorkspaceOverview extends WorkspaceOverviewCore {
  desk: ReturnType<typeof buildPhaseCWorkspaceDesk>;
}

export interface WorkspaceOverviewWithNavigator extends WorkspaceOverview {
  navigator: ReturnType<typeof buildPhaseCProcessNavigator>;
}

export interface WorkspaceFetchErrors {
  jurisdictions?: unknown;
  matters?: unknown;
  compliance?: unknown;
  hitl?: unknown;
}

export interface WorkspaceOverviewQueryResults {
  jurisdictionsResult: PostgrestSingleResponse<JurisdictionRow>;
  mattersResult: PostgrestSingleResponse<MatterRow>;
  complianceResult: PostgrestSingleResponse<ComplianceRow>;
  hitlResult: HitlQueryResult;
}

export const JURISDICTION_OVERVIEW_FIELDS = 'code, name, eu, ohada';
export const MATTER_OVERVIEW_FIELDS =
  'id, question, risk_level, hitl_required, status, started_at, finished_at, jurisdiction_json';
export const COMPLIANCE_OVERVIEW_FIELDS =
  'id, title, publisher, source_url, jurisdiction_code, consolidated, effective_date, created_at';

export function extractCountry(value: unknown): string | null {
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
}

export function normalizeWorkspaceOverview({
  jurisdictions,
  matters,
  compliance,
  hitl,
}: {
  jurisdictions: JurisdictionRow[];
  matters: MatterRow[];
  compliance: ComplianceRow[];
  hitl: HitlQueueRow[];
}): WorkspaceOverviewCore {
  const matterCounts = new Map<string, number>();
  for (const row of matters) {
    const jurisdiction = extractCountry(row.jurisdiction_json);
    const key = jurisdiction ?? 'UNK';
    matterCounts.set(key, (matterCounts.get(key) ?? 0) + 1);
  }

  const jurisdictionsWithCounts = jurisdictions.map((row) => ({
    code: row.code,
    name: row.name,
    eu: row.eu,
    ohada: row.ohada,
    matterCount: matterCounts.get(row.code) ?? 0,
  }));

  const mattersOverview = matters.map((row) => ({
    id: row.id,
    question: row.question,
    status: row.status,
    riskLevel: row.risk_level,
    hitlRequired: row.hitl_required,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    jurisdiction: extractCountry(row.jurisdiction_json),
  }));

  const complianceWatch = compliance.map((row) => ({
    id: row.id,
    title: row.title,
    publisher: row.publisher,
    url: row.source_url,
    jurisdiction: row.jurisdiction_code,
    consolidated: row.consolidated,
    effectiveDate: row.effective_date,
    createdAt: row.created_at,
  }));

  return {
    jurisdictions: jurisdictionsWithCounts,
    matters: mattersOverview,
    complianceWatch,
    hitlInbox: buildHitlInbox(hitl),
  };
}

export function collectWorkspaceFetchErrors({
  jurisdictionsResult,
  mattersResult,
  complianceResult,
  hitlResult,
}: WorkspaceOverviewQueryResults): WorkspaceFetchErrors {
  return {
    jurisdictions: jurisdictionsResult.error ?? undefined,
    matters: mattersResult.error ?? undefined,
    compliance: complianceResult.error ?? undefined,
    hitl: hitlResult.error ?? undefined,
  };
}

export async function queryWorkspaceOverview(
  supabase: SupabaseClient,
  orgId: string,
): Promise<WorkspaceOverviewQueryResults> {
  const [jurisdictionsResult, mattersResult, complianceResult, hitlResult] = await Promise.all([
    supabase.from('jurisdictions').select(JURISDICTION_OVERVIEW_FIELDS).order('name', { ascending: true }),
    supabase
      .from('agent_runs')
      .select(MATTER_OVERVIEW_FIELDS)
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(8),
    supabase
      .from('sources')
      .select(COMPLIANCE_OVERVIEW_FIELDS)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('hitl_queue')
      .select(HITL_OVERVIEW_FIELDS)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  return { jurisdictionsResult, mattersResult, complianceResult, hitlResult };
}

export async function getWorkspaceOverview(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ overview: WorkspaceOverviewWithNavigator; errors: WorkspaceFetchErrors }> {
  const results = await queryWorkspaceOverview(supabase, orgId);

  const overviewCore = normalizeWorkspaceOverview({
    jurisdictions: results.jurisdictionsResult.data ?? [],
    matters: results.mattersResult.data ?? [],
    compliance: results.complianceResult.data ?? [],
    hitl: results.hitlResult.data ?? [],
  });

  return {
    overview: {
      ...overviewCore,
      desk: buildPhaseCWorkspaceDesk(),
      navigator: buildPhaseCProcessNavigator(),
    },
    errors: collectWorkspaceFetchErrors(results),
  };
}

// Alias for compatibility with routes that expect { data, errors } structure
export async function fetchWorkspaceOverview(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ data: WorkspaceOverviewWithNavigator; errors: WorkspaceFetchErrors }> {
  const { overview, errors } = await getWorkspaceOverview(supabase, orgId);
  return { data: overview, errors };
}
