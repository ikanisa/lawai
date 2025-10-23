-- Track ingestion runs and enable runtime activation toggles for authority domains
ALTER TABLE public.authority_domains
ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_ingested_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  adapter_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  inserted_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_message text
);

CREATE INDEX if NOT EXISTS ingestion_runs_adapter_idx ON public.ingestion_runs (adapter_id, started_at DESC);
