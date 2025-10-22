/// <reference lib="deno.unstable" />

import { createEdgeClient, rowsAs } from '../lib/supabase.ts';
import { instrumentEdgeHandler } from '../lib/telemetry.ts';

const WINDOW_MINUTES = 10;

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

type AgentRunRow = {
  id: string;
  org_id: string | null;
  status: string | null;
  refusal_reason: string | null;
  jurisdiction_json: unknown;
  risk_level: string | null;
};

type CitationRow = {
  run_id: string | null;
  org_id: string | null;
  domain_ok: boolean | null;
  translation_flag: string | null;
  url: string | null;
};

type TelemetryRow = {
  org_id: string | null;
  tool_name: string | null;
  latency_ms: number | null;
  success: boolean | null;
  error_code: string | null;
};

type HitlRow = {
  org_id: string | null;
  run_id: string | null;
  status: string | null;
  reviewer_comment: string | null;
  updated_at: string | null;
};

Deno.serve(
  instrumentEdgeHandler('learning-collector', async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response('missing_supabase_env', { status: 500 });
  }

  const supabase = createEdgeClient(supabaseUrl, serviceKey, {
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

  const runRows = rowsAs<AgentRunRow>(runs.data);
  for (const row of runRows) {
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

  const citationRows = rowsAs<CitationRow>(citations.data);
  for (const row of citationRows) {
    if (!row.run_id) {
      continue;
    }
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

  const telemetryRows = rowsAs<TelemetryRow>(telemetry.data);
  for (const row of telemetryRows) {
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

  const hitlRows = rowsAs<HitlRow>(hitl.data);
  for (const row of hitlRows) {
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

  const { error } = await supabase.from('learning_signals').insert(signals);
  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ inserted: signals.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
  }),
);
