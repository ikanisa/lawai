-- Create run_retrieval_sets to capture hybrid retrieval context per agent execution
CREATE TABLE IF NOT EXISTS public.run_retrieval_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs (id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  origin text NOT NULL CHECK (origin IN ('local', 'file_search')),
  snippet text NOT NULL,
  similarity numeric(6, 5),
  weight numeric(6, 5),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS run_retrieval_sets_run_id_idx ON public.run_retrieval_sets (run_id);

CREATE INDEX if NOT EXISTS run_retrieval_sets_org_id_idx ON public.run_retrieval_sets (org_id);
