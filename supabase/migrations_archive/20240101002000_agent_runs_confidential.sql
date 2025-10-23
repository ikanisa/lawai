ALTER TABLE public.agent_runs
ADD COLUMN IF NOT EXISTS confidential_mode boolean NOT NULL DEFAULT FALSE;

CREATE INDEX if NOT EXISTS agent_runs_confidential_idx ON public.agent_runs (confidential_mode);
