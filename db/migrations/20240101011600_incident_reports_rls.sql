ALTER TABLE public.incident_reports enable ROW level security;

DROP POLICY if EXISTS incident_reports_select ON public.incident_reports;

CREATE POLICY incident_reports_select ON public.incident_reports FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS incident_reports_modify ON public.incident_reports;

CREATE POLICY incident_reports_modify ON public.incident_reports FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
