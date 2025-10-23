ALTER TABLE public.compliance_assessments enable ROW level security;

DROP POLICY if EXISTS "compliance assessments by org" ON public.compliance_assessments;

CREATE POLICY "compliance assessments by org" ON public.compliance_assessments FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
