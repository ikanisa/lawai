-- Enforce tenant isolation for ingestion quarantine records
ALTER TABLE public.ingestion_quarantine enable ROW level security;

DROP POLICY if EXISTS "quarantine_read" ON public.ingestion_quarantine;

CREATE POLICY "quarantine_read" ON public.ingestion_quarantine FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS "quarantine_manage" ON public.ingestion_quarantine;

CREATE POLICY "quarantine_manage" ON public.ingestion_quarantine FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
