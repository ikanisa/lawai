alter table public.agent_runs
  add column if not exists plan_trace jsonb,
  add column if not exists run_key text;

create unique index if not exists agent_runs_run_key_idx
  on public.agent_runs (org_id, run_key)
  where run_key is not null;
