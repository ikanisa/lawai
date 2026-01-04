/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';

const WINDOW_MINUTES = 10;

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

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

  const sinceIso = isoMinutesAgo(WINDOW_MINUTES);

  const [runs, citations, telemetry, hitl] = await Promise.all([
    supabase
      .from('agent_runs')
      .select('id, org_id, status, refusal_reason, jurisdiction_json, created_at, risk_level')
      .gte('created_at', sinceIso)
      .limit(200),
    supabase
      .from('run_citations')
      .select('run_id, org_id, domain_ok, translation_flag, url, created_at')
      .gte('created_at', sinceIso)
      .limit(500),
    supabase
      .from('tool_telemetry')
      .select('id, org_id, tool_name, latency_ms, success, error_code, created_at')
      .gte('created_at', sinceIso)
      .limit(500),
    supabase
      .from('hitl_queue')
      .select('id, org_id, run_id, status, reviewer_comment, created_at, updated_at')
      .gte('created_at', sinceIso)
      .limit(200),
  ]);

  const signals: Array<Record<string, unknown>> = [];

  for (const row of asArray(runs.data)) {
    signals.push({
      org_id: row.org_id,
      run_id: row.id,
      source: 'agent_run',
      kind: row.status,
      payload: {
        risk_level: row.risk_level,
        refusal_reason: row.refusal_reason ?? null,
        jurisdiction: row.jurisdiction_json ?? null,
      },
    });
  }

  for (const row of asArray(citations.data)) {
    signals.push({
      org_id: row.org_id,
      run_id: row.run_id,
      source: 'run_citation',
      kind: row.domain_ok ? 'allowlisted' : 'violation',
      payload: {
        url: row.url,
        translation_flag: row.translation_flag ?? null,
      },
    });
  }

  for (const row of asArray(telemetry.data)) {
    signals.push({
      org_id: row.org_id,
      run_id: null,
      source: 'tool_telemetry',
      kind: row.success ? 'success' : 'failure',
      payload: {
        tool: row.tool_name,
        latency_ms: row.latency_ms,
        error_code: row.error_code ?? null,
      },
    });
  }

  for (const row of asArray(hitl.data)) {
    signals.push({
      org_id: row.org_id,
      run_id: row.run_id,
      source: 'hitl',
      kind: row.status,
      payload: {
        reviewer_comment: row.reviewer_comment ?? null,
        updated_at: row.updated_at,
      },
    });
  }

  if (signals.length === 0) {
    return new Response(JSON.stringify({ inserted: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supabase.from('learning_signals').insert(signals, { returning: 'minimal' });
  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ inserted: signals.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

