/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    return new Response('missing_supabase_env', { status: 500 });
  }
  const apiBase = new URL(Deno.env.get('SUPABASE_URL') ?? '').origin; // same origin API
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.from('organizations').select('id').limit(100);
  if (error) return new Response('org_query_failed', { status: 500 });
  const results: Array<{ orgId: string; status: number; updated?: number }> = [];
  for (const row of data ?? []) {
    const orgId = (row as any).id as string;
    const res = await fetch(`${apiBase}/cases/recompute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}`, 'x-user-id': orgId },
      body: JSON.stringify({ orgId, limit: 500 }),
    });
    results.push({ orgId, status: res.status, updated: res.ok ? (await res.json()).updated ?? 0 : 0 });
  }
  return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
});

