ALTER TABLE public.transparency_reports enable ROW level security;

DROP POLICY if EXISTS "transparency reports by org" ON public.transparency_reports;

CREATE POLICY "transparency reports by org" ON public.transparency_reports FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
