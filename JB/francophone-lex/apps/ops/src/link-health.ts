#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

async function head(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const orgId = process.env.OPS_ORG_ID ?? '00000000-0000-0000-0000-000000000000';
  if (!url || !key) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('sources')
    .select('id, source_url')
    .eq('org_id', orgId)
    .order('link_last_checked_at', { ascending: true })
    .limit(50);
  if (error) throw error;
  const rows = data ?? [];
  let failed = 0;
  for (const row of rows) {
    const url = row.source_url as string;
    const res = await head(url);
    const status = res.ok ? 'ok' : 'failed';
    if (!res.ok) failed += 1;
    await supabase
      .from('sources')
      .update({ link_last_checked_at: new Date().toISOString(), link_last_status: status, link_last_error: res.ok ? null : `HTTP ${res.status}` })
      .eq('id', row.id);
  }
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

