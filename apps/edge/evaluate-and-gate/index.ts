/// <reference lib="deno.unstable" />

import { createEdgeClient, EdgeSupabaseClient, rowAs } from '../lib/supabase.ts';

const PRECISION_THRESHOLD = 0.95;
const DEAD_LINK_THRESHOLD = 0.01;

type LearningMetricRow = {
  value: number | null;
  computed_at: string;
};

type PolicyVersionRow = {
  id: string;
  org_id: string | null;
  version_number: number | null;
};

async function fetchLatestMetric(supabase: EdgeSupabaseClient, metric: string) {
  const response = await supabase
    .from('learning_metrics')
    .select('value, computed_at')
    .eq('metric', metric)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle<LearningMetricRow>();
  if (response.error) throw response.error;
  return rowAs<LearningMetricRow>(response.data);
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response('missing_supabase_env', { status: 500 });
  }

  const supabase = createEdgeClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [precisionMetric, deadLinkMetric] = await Promise.all([
      fetchLatestMetric(supabase, 'citations_allowlisted_ratio'),
      fetchLatestMetric(supabase, 'dead_link_rate'),
    ]);

    const rollbackReasons: string[] = [];
    if (precisionMetric && precisionMetric.value !== null && precisionMetric.value < PRECISION_THRESHOLD) {
      rollbackReasons.push('allowlisted_precision_regression');
    }
    if (deadLinkMetric && deadLinkMetric.value !== null && deadLinkMetric.value > DEAD_LINK_THRESHOLD) {
      rollbackReasons.push('dead_link_rate_exceeded');
    }

    if (rollbackReasons.length === 0) {
      return new Response(JSON.stringify({ rollback: false }), { headers: { 'Content-Type': 'application/json' } });
    }

    const latestApproved = await supabase
      .from('agent_policy_versions')
      .select('id, org_id, version_number')
      .eq('status', 'approved')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle<PolicyVersionRow>();

    const latestApprovedRow = rowAs<PolicyVersionRow>(latestApproved.data);

    if (latestApproved.error || !latestApprovedRow) {
      return new Response(JSON.stringify({ rollback: false, message: 'no approved version' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const versionId = latestApprovedRow.id;

    await supabase
      .from('agent_policy_versions')
      .update({ status: 'rolled_back', notes: rollbackReasons.join(', '), approved_at: null, approved_by: null })
      .eq('id', versionId);

    await supabase
      .from('agent_learning_jobs')
      .update({ status: 'ROLLED_BACK' })
      .eq('policy_version_id', versionId);

    return new Response(JSON.stringify({ rollback: true, versionId, reasons: rollbackReasons }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response((error as Error).message ?? 'evaluate_failed', { status: 500 });
  }
});
