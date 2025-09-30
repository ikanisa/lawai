/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';

const BATCH_SIZE = 25;

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response('missing_supabase_env', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const jobs = await supabase
    .from('agent_learning_jobs')
    .select('id, org_id, job_type, payload')
    .eq('status', 'READY')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (jobs.error) {
    return new Response(jobs.error.message, { status: 500 });
  }

  const rows = jobs.data ?? [];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ created_versions: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  const grouped = new Map<string, Array<{ id: string; job_type: string; payload: Record<string, unknown> }>>();
  for (const job of rows) {
    const list = grouped.get(job.org_id) ?? [];
    list.push({ id: job.id, job_type: job.job_type, payload: job.payload as Record<string, unknown> });
    grouped.set(job.org_id, list);
  }

  const createdVersions: Array<{ id: string; org_id: string; jobIds: string[] }> = [];

  for (const [orgId, jobsForOrg] of grouped.entries()) {
    const changeSet = jobsForOrg.map((entry) => ({ job_type: entry.job_type, payload: entry.payload }));
    const insert = await supabase
      .from('agent_policy_versions')
      .insert({ org_id: orgId, status: 'draft', change_set: changeSet })
      .select('id, version_number')
      .maybeSingle();

    if (insert.error || !insert.data) {
      console.error('policy_version_insert_failed', insert.error?.message);
      continue;
    }

    const versionId = insert.data.id as string;
    const jobIds = jobsForOrg.map((job) => job.id);
    const update = await supabase
      .from('agent_learning_jobs')
      .update({ status: 'NEEDS_APPROVAL', policy_version_id: versionId })
      .in('id', jobIds);
    if (update.error) {
      console.error('learning_jobs_update_failed', update.error.message);
      continue;
    }

    createdVersions.push({ id: versionId, org_id: orgId, jobIds });
  }

  return new Response(JSON.stringify({ created_versions: createdVersions.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

