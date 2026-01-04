/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';

type DeltaRequest = { limit?: number };

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return new Response('missing_supabase_env', { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const apiBase = new URL(req.url).origin; // call same origin API

    const body = (await req.json().catch(() => ({}))) as DeltaRequest;
    const limit = typeof body.limit === 'number' ? Math.max(1, Math.min(body.limit, 50)) : 50;

    // Fetch orgs that have GDrive state
    const { data, error } = await supabase.from('gdrive_state').select('org_id').limit(limit);
    if (error) {
      return new Response('state_query_failed', { status: 500 });
    }
    const orgs = (data ?? []).map((row: any) => row.org_id as string);
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

