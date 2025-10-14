/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';

async function head(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    return new Response('missing_supabase_env', { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase
    .from('sources')
    .select('id, source_url')
    .order('link_last_checked_at', { ascending: true })
    .limit(100);
  if (error) return new Response('query_failed', { status: 500 });

  let failed = 0;
  for (const row of data ?? []) {
    const u = (row as any).source_url as string;
    const res = await head(u);
    const status = res.ok ? 'ok' : 'failed';
    if (!res.ok) failed += 1;
    await supabase
      .from('sources')
      .update({ link_last_checked_at: new Date().toISOString(), link_last_status: status, link_last_error: res.ok ? null : `HTTP ${res.status}` })
      .eq('id', (row as any).id as string);
  }
  return new Response(JSON.stringify({ checked: data?.length ?? 0, failed }), { headers: { 'Content-Type': 'application/json' } });
});

