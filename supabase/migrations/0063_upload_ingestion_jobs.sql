-- Track PDF upload ingestion jobs and guardrail metadata
CREATE TABLE IF NOT EXISTS public.upload_ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'processing',
      'completed',
      'failed',
      'quarantined'
    )
  ),
  hash_sha256 text,
  confidentiality text NOT NULL DEFAULT 'internal',
  guardrail_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata jsonb,
  quarantine_reason text,
  progress integer NOT NULL DEFAULT 0 CHECK (
    progress >= 0
    AND progress <= 100
  ),
  error text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, document_id)
);

CREATE INDEX if NOT EXISTS upload_ingestion_jobs_status_idx ON public.upload_ingestion_jobs (status);

CREATE INDEX if NOT EXISTS upload_ingestion_jobs_org_idx ON public.upload_ingestion_jobs (org_id);
