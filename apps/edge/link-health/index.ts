/// <reference lib="deno.unstable" />

import { createEdgeClient } from '../lib/supabase.ts';
import { instrumentEdgeHandler } from '../lib/telemetry.ts';

async function head(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

Deno.serve(
  instrumentEdgeHandler('link-health', async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    return new Response('missing_supabase_env', { status: 500 });
  }
  const supabase = createEdgeClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from('sources')
    .select('id, source_url')
    .order('link_last_checked_at', { ascending: true })
    .limit(100);
  if (error) return new Response('query_failed', { status: 500 });

  let failed = 0;
  type SourceRow = {
    id: string;
    source_url: string | null;
  };

  const rows = (data ?? []) as SourceRow[];
  for (const row of rows) {
    if (!row.source_url) {
      continue;
    }
    const res = await head(row.source_url);
    const status = res.ok ? 'ok' : 'failed';
    if (!res.ok) failed += 1;
    await supabase
      .from('sources')
      .update({
        link_last_checked_at: new Date().toISOString(),
        link_last_status: status,
        link_last_error: res.ok ? null : `HTTP ${res.status}`,
      })
      .eq('id', row.id);
  }
  return new Response(JSON.stringify({ checked: data?.length ?? 0, failed }), { headers: { 'Content-Type': 'application/json' } });
  }),
);
