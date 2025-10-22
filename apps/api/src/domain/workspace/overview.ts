import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from './navigator.js';

export type WorkspaceMatter = {
  id: string;
  question: string;
  status: string | null;
  riskLevel: string | null;
  hitlRequired: boolean | null;
  startedAt: string | null;
  finishedAt: string | null;
  jurisdiction: string | null;
};

export type WorkspaceJurisdiction = {
  code: string;
  name: string;
  eu: boolean;
  ohada: boolean;
  matterCount: number;
};

export type WorkspaceComplianceItem = {
  id: string;
  title: string;
  publisher: string | null;
  url: string;
  jurisdiction: string | null;
  consolidated: boolean | null;
  effectiveDate: string | null;
  createdAt: string | null;
};

export type WorkspaceHitlItem = {
  id: string;
  runId: string;
  reason: string;
  status: string;
  createdAt: string | null;
};

export type WorkspaceOverview = {
  jurisdictions: WorkspaceJurisdiction[];
  matters: WorkspaceMatter[];
  complianceWatch: WorkspaceComplianceItem[];
  hitlInbox: {
    items: WorkspaceHitlItem[];
    pendingCount: number;
  };
  desk: ReturnType<typeof buildPhaseCWorkspaceDesk>;
  navigator: ReturnType<typeof buildPhaseCProcessNavigator>;
};

export type WorkspaceFetchErrors = {
  jurisdictions?: unknown;
  matters?: unknown;
  compliance?: unknown;
  hitl?: unknown;
};

export const extractCountry = (value: unknown): string | null => {
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
    const jurisdiction = extractCountry((row as { jurisdiction_json?: unknown }).jurisdiction_json);
    const key = jurisdiction ?? 'UNK';
    matterCounts.set(key, (matterCounts.get(key) ?? 0) + 1);
  }

  const jurisdictions: WorkspaceJurisdiction[] = jurisdictionRows.map((row) => ({
    code: (row as { code: string }).code,
    name: (row as { name: string }).name,
    eu: (row as { eu: boolean }).eu,
    ohada: (row as { ohada: boolean }).ohada,
    matterCount: matterCounts.get((row as { code: string }).code) ?? 0,
  }));

  const matters: WorkspaceMatter[] = matterRows.map((row) => ({
    id: (row as { id: string }).id,
    question: (row as { question: string }).question,
    status: (row as { status?: string | null }).status ?? null,
    riskLevel: (row as { risk_level?: string | null }).risk_level ?? null,
    hitlRequired: (row as { hitl_required?: boolean | null }).hitl_required ?? null,
    startedAt: (row as { started_at?: string | null }).started_at ?? null,
    finishedAt: (row as { finished_at?: string | null }).finished_at ?? null,
    jurisdiction: extractCountry((row as { jurisdiction_json?: unknown }).jurisdiction_json),
  }));

  const complianceWatch: WorkspaceComplianceItem[] = complianceRows.map((row) => ({
    id: (row as { id: string }).id,
    title: (row as { title: string }).title,
    publisher: (row as { publisher?: string | null }).publisher ?? null,
    url: (row as { source_url: string }).source_url,
    jurisdiction: (row as { jurisdiction_code?: string | null }).jurisdiction_code ?? null,
    consolidated: (row as { consolidated?: boolean | null }).consolidated ?? null,
    effectiveDate: (row as { effective_date?: string | null }).effective_date ?? null,
    createdAt: (row as { created_at?: string | null }).created_at ?? null,
  }));

  const hitlInboxItems: WorkspaceHitlItem[] = hitlRows.map((row) => ({
    id: (row as { id: string }).id,
    runId: (row as { run_id: string }).run_id,
    reason: (row as { reason: string }).reason,
    status: (row as { status: string }).status,
    createdAt: (row as { created_at?: string | null }).created_at ?? null,
  }));

  const pendingCount = hitlInboxItems.filter((item) => item.status === 'pending').length;

  return {
    data: {
      jurisdictions,
      matters,
      complianceWatch,
      hitlInbox: {
        items: hitlInboxItems,
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
