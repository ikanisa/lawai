import type { EdgeSupabaseClient } from '../../../edge/lib/supabase';

export async function fetchWorkspaceOverview(supabase: EdgeSupabaseClient, orgId: string) {
  const { data: runs, error } = await supabase
    .from('agent_runs')
    .select('id, question, status, risk_level, jurisdiction_json, started_at, finished_at, hitl_required')
    .eq('org_id', orgId)
    .order('started_at', { ascending: false })
    .limit(8);

  return { runs, error };
}
