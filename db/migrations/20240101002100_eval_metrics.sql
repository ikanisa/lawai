ALTER TABLE public.eval_results
ADD COLUMN IF NOT EXISTS metrics jsonb,
ADD COLUMN IF NOT EXISTS citation_precision numeric,
ADD COLUMN IF NOT EXISTS temporal_validity numeric,
ADD COLUMN IF NOT EXISTS binding_warnings integer;

CREATE INDEX if NOT EXISTS eval_results_case_idx ON public.eval_results (case_id, created_at DESC);
