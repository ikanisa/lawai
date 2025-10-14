/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';

const LOOKBACK_RUNS = 200;
const PRECISION_THRESHOLD = 0.95;
const TEMPORAL_THRESHOLD = 0.95;
const DEAD_LINK_THRESHOLD = 0.01;

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response('missing_supabase_env', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runs = await supabase
    .from('agent_runs')
    .select('id, org_id')
    .order('created_at', { ascending: false })
    .limit(LOOKBACK_RUNS);

  if (runs.error) {
    return new Response(runs.error.message, { status: 500 });
  }

  const runIds = asArray(runs.data).map((row) => row.id as string);
  if (runIds.length === 0) {
    return new Response(JSON.stringify({ metrics: [] }), { headers: { 'Content-Type': 'application/json' } });
  }

  const citations = await supabase
    .from('run_citations')
    .select('run_id, domain_ok, created_at')
    .in('run_id', runIds);

  if (citations.error) {
    return new Response(citations.error.message, { status: 500 });
  }

  let allowlisted = 0;
  let totalCitations = 0;
  let staleLinks = 0;

  for (const row of asArray(citations.data)) {
    totalCitations += 1;
    if (row.domain_ok) {
      allowlisted += 1;
    }
    if (!row.domain_ok) {
      staleLinks += 1;
    }
  }

  const allowlistedRatio = totalCitations === 0 ? 1 : allowlisted / totalCitations;
  const deadLinkRate = totalCitations === 0 ? 0 : staleLinks / totalCitations;

  const metricsPayload = [
    {
      window: 'last_200_runs',
      metric: 'citations_allowlisted_ratio',
      value: allowlistedRatio,
      dims: {},
    },
    {
      window: 'last_200_runs',
      metric: 'dead_link_rate',
      value: deadLinkRate,
      dims: {},
    },
  ];

  const { error: metricsError } = await supabase
    .from('learning_metrics')
    .insert(metricsPayload, { returning: 'minimal' });

  if (metricsError) {
    return new Response(metricsError.message, { status: 500 });
  }

  const jobs: Array<Record<string, unknown>> = [];

  if (allowlistedRatio < PRECISION_THRESHOLD) {
    jobs.push({
      job_type: 'guardrail_tune',
      status: 'READY',
      payload: { reason: 'allowlisted_precision_regression', value: allowlistedRatio },
    });
  }

  if (deadLinkRate > DEAD_LINK_THRESHOLD) {
    jobs.push({
      job_type: 'canonicalizer_update',
      status: 'READY',
      payload: { reason: 'dead_link_rate', value: deadLinkRate },
    });
  }

  if (jobs.length > 0) {
    const { error: jobsError } = await supabase
      .from('agent_learning_jobs')
      .insert(jobs, { returning: 'minimal' });
    if (jobsError) {
      return new Response(jobsError.message, { status: 500 });
    }
  }

  return new Response(
    JSON.stringify({ metrics: metricsPayload.length, jobs: jobs.length }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});

