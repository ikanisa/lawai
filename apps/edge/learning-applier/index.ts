/// <reference lib="deno.unstable" />

import { createEdgeClient, rowAs, rowsAs } from '../lib/supabase.ts';
import { instrumentEdgeHandler } from '../lib/telemetry.ts';

const BATCH_SIZE = 25;

type LearningJobRow = {
  id: string;
  org_id: string | null;
  job_type: string;
  payload: Record<string, unknown> | null;
};

type PolicyVersionRow = {
  id: string;
  version_number: number | null;
};

Deno.serve(
  instrumentEdgeHandler('learning-applier', async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response('missing_supabase_env', { status: 500 });
  }

  const supabase = createEdgeClient(supabaseUrl, serviceKey, {
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

  const rows = rowsAs<LearningJobRow>(jobs.data);
  if (rows.length === 0) {
    return new Response(JSON.stringify({ created_versions: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  const grouped = new Map<string, Array<{ id: string; job_type: string; payload: Record<string, unknown> }>>();
  for (const job of rows) {
    if (!job.org_id) {
      continue;
    }
    const list = grouped.get(job.org_id) ?? [];
    list.push({ id: job.id, job_type: job.job_type, payload: job.payload ?? {} });
    grouped.set(job.org_id, list);
  }

  const createdVersions: Array<{ id: string; org_id: string; jobIds: string[] }> = [];

  for (const [orgId, jobsForOrg] of grouped.entries()) {
    const changeSet = jobsForOrg.map((entry) => ({ job_type: entry.job_type, payload: entry.payload }));
    const insert = await supabase
      .from('agent_policy_versions')
      .insert({ org_id: orgId, status: 'draft', change_set: changeSet })
      .select('id, version_number')
      .maybeSingle<PolicyVersionRow>();

    const versionRow = rowAs<PolicyVersionRow>(insert.data);
    if (insert.error || !versionRow) {
      console.error('policy_version_insert_failed', insert.error?.message);
      continue;
    }

    const versionId = versionRow.id;
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
  }),
);
