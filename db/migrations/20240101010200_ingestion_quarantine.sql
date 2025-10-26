-- Track authoritative documents that were quarantined during ingestion
CREATE TABLE IF NOT EXISTS public.ingestion_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  adapter_id text NOT NULL,
  source_url text NOT NULL,
  canonical_url text,
  reason text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, source_url, reason)
);

CREATE INDEX if NOT EXISTS ingestion_quarantine_org_idx ON public.ingestion_quarantine (org_id);

CREATE INDEX if NOT EXISTS ingestion_quarantine_adapter_idx ON public.ingestion_quarantine (adapter_id);

CREATE INDEX if NOT EXISTS ingestion_quarantine_reason_idx ON public.ingestion_quarantine (reason);
