/// <reference lib="deno.unstable" />

import { createEdgeClient, rowsAs } from '../lib/supabase.ts';

type Env = {
  supabaseUrl?: string;
  supabaseServiceRole?: string;
  orgId?: string;
};

type OrgRow = { id: string | null };

type ProvenanceRow = {
  org_id: string;
  total_sources?: number | null;
  sources_link_ok_recent?: number | null;
  sources_link_stale?: number | null;
  sources_link_failed?: number | null;
};

function toNumber(input: unknown): number | null {
  const n = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function listOrgIds(client: ReturnType<typeof createEdgeClient>, orgId?: string): Promise<string[]> {
  if (orgId) return [orgId];
  const { data, error } = await client.from('organizations').select('id');
  if (error) {
    console.warn('provenance_alerts_list_orgs_failed', error.message);
    return [];
  }
  return rowsAs<OrgRow>(data)
    .map((r) => r.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function buildSlackText(orgId: string, row: ProvenanceRow, thresholds: { staleRatio: number; failedCount: number }) {
  const total = toNumber(row.total_sources) ?? 0;
  const stale = toNumber(row.sources_link_stale) ?? 0;
  const failed = toNumber(row.sources_link_failed) ?? 0;
  const ok = toNumber(row.sources_link_ok_recent) ?? 0;
  const ratio = total > 0 ? stale / total : 0;
  const lines = [
    `provenance-alerts: link-health for ${orgId}`,
    `- ok_recent: ${ok}`,
    `- stale: ${stale} (${(ratio * 100).toFixed(1)}%) (threshold ${(thresholds.staleRatio * 100).toFixed(0)}%)`,
    `- failed: ${failed} (threshold ${thresholds.failedCount})`,
  ];
  return lines.join('\n');
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  } as const;
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const url = new URL(req.url);
  const payload: Env = {};
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body === 'object') Object.assign(payload, body as Env);
  }
  if (!payload.orgId && url.searchParams.has('orgId')) {
    payload.orgId = url.searchParams.get('orgId') ?? undefined;
  }

  const supabaseUrl = payload.supabaseUrl ?? Deno.env.get('SUPABASE_URL');
  const supabaseServiceRole =
    payload.supabaseServiceRole ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE');

  if (!supabaseUrl || !supabaseServiceRole) {
    return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), { status: 400 });
  }

  const supabase = createEdgeClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const staleRatioThreshold = Number(Deno.env.get('PROVENANCE_STALE_RATIO_THRESHOLD') ?? '0.15');
  const failedCountThreshold = Number(Deno.env.get('PROVENANCE_FAILED_COUNT_THRESHOLD') ?? '0');

  const orgIds = await listOrgIds(supabase, payload.orgId);
  const results: Array<{ orgId: string; alerted: boolean; stale: number; failed: number }> = [];

  for (const orgId of orgIds) {
    const { data, error } = await supabase
      .from('org_provenance_metrics')
      .select('org_id, total_sources, sources_link_ok_recent, sources_link_stale, sources_link_failed')
      .eq('org_id', orgId)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('provenance_alerts_metrics_failed', orgId, error.message);
      results.push({ orgId, alerted: false, stale: 0, failed: 0 });
      continue;
    }
    if (!data) {
      results.push({ orgId, alerted: false, stale: 0, failed: 0 });
      continue;
    }
    const row = data as ProvenanceRow;
    const total = toNumber(row.total_sources) ?? 0;
    const stale = toNumber(row.sources_link_stale) ?? 0;
    const failed = toNumber(row.sources_link_failed) ?? 0;
    const ratio = total > 0 ? stale / total : 0;

    const trigger = ratio >= staleRatioThreshold || failed >= failedCountThreshold;
    if (trigger) {
      try {
        const webhook = Deno.env.get('ALERTS_SLACK_WEBHOOK_URL');
        if (webhook) {
          const text = buildSlackText(orgId, row, {
            staleRatio: staleRatioThreshold,
            failedCount: failedCountThreshold,
          });
          await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          }).catch((err) => console.warn('slack_webhook_post_failed', err));
        }
        const emailWebhook = Deno.env.get('ALERTS_EMAIL_WEBHOOK_URL');
        if (emailWebhook) {
          const payloadEmail = {
            subject: `Provenance alerts: link-health for ${orgId}`,
            body: row,
          };
          await fetch(emailWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadEmail),
          }).catch((err) => console.warn('email_webhook_post_failed', err));
        }
      } catch (err) {
        console.warn('provenance_alerts_dispatch_failed', orgId, err);
      }
    }
    results.push({ orgId, alerted: trigger, stale, failed });
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
