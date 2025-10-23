-- Export jobs and deletion requests with RLS
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  format text NOT NULL CHECK (format IN ('csv', 'json')) DEFAULT 'csv',
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  file_path text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX if NOT EXISTS export_jobs_org_idx ON public.export_jobs (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  target text NOT NULL CHECK (target IN ('document', 'source', 'org')),
  target_id uuid,
  reason text,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);

CREATE INDEX if NOT EXISTS deletion_requests_org_idx ON public.deletion_requests (org_id, created_at DESC);

ALTER TABLE public.export_jobs enable ROW level security;

ALTER TABLE public.deletion_requests enable ROW level security;

DROP POLICY if EXISTS export_jobs_by_org ON public.export_jobs;

CREATE POLICY export_jobs_by_org ON public.export_jobs FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS deletion_requests_by_org ON public.deletion_requests;

CREATE POLICY deletion_requests_by_org ON public.deletion_requests FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
