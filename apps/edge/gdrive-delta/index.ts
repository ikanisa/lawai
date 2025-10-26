/// <reference lib="deno.unstable" />

import { createEdgeClient, rowsAs } from '../lib/supabase.ts';
import { serveEdgeFunction } from '../lib/serve.ts';

type DeltaRequest = { limit?: number };

serveEdgeFunction(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return new Response('missing_supabase_env', { status: 500 });
    }
    const supabase = createEdgeClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const apiBase = new URL(req.url).origin; // call same origin API

    const body = (await req.json().catch(() => ({}))) as DeltaRequest;
    const limit = typeof body.limit === 'number' ? Math.max(1, Math.min(body.limit, 50)) : 50;

    // Fetch orgs that have GDrive state
    const { data, error } = await supabase.from('gdrive_state').select('org_id').limit(limit);
    if (error) {
      return new Response('state_query_failed', { status: 500 });
    }
    const orgRows = rowsAs<{ org_id: string | null }>(data);
    const orgs = orgRows
      .map((row) => row.org_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    const results: Array<{ orgId: string; processed?: number; status: number }> = [];
    for (const orgId of orgs) {
      const res = await fetch(`${apiBase}/gdrive/process-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify({ orgId }),
      });
      results.push({ orgId, status: res.status, processed: res.ok ? (await res.json()).processed ?? 0 : 0 });
    }

    return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response((error as Error).message ?? 'delta_failed', { status: 500 });
  }
});
