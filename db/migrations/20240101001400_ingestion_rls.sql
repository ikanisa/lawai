ALTER TABLE public.ingestion_runs enable ROW level security;

DROP POLICY if EXISTS "ingestion runs by org" ON public.ingestion_runs;

CREATE POLICY "ingestion runs by org" ON public.ingestion_runs FOR ALL USING (
  org_id IS NULL
  OR public.is_org_member (org_id)
)
WITH
  CHECK (
    org_id IS NULL
    OR public.is_org_member (org_id)
  );

DROP POLICY if EXISTS "authority domains readable" ON public.authority_domains;

CREATE POLICY "authority domains readable" ON public.authority_domains FOR
SELECT
  USING (TRUE);
