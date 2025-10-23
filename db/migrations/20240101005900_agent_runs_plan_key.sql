ALTER TABLE public.agent_runs
ADD COLUMN IF NOT EXISTS plan_trace jsonb,
ADD COLUMN IF NOT EXISTS run_key text;

CREATE UNIQUE INDEX if NOT EXISTS agent_runs_run_key_idx ON public.agent_runs (org_id, run_key)
WHERE
  run_key IS NOT NULL;
