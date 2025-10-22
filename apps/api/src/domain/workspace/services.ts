import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPhaseCWorkspaceDesk } from '../../workspace.js';
import { extractCountry } from '../../utils/jurisdictions.js';

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
    },
    errors: {
      jurisdictions: jurisdictionsResult.error ?? undefined,
      matters: mattersResult.error ?? undefined,
      compliance: complianceResult.error ?? undefined,
      hitl: hitlResult.error ?? undefined,
    },
  };
}
