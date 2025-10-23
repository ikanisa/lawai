-- RLS policies for case quality tables
ALTER TABLE public.case_scores enable ROW level security;

ALTER TABLE public.case_treatments enable ROW level security;

ALTER TABLE public.case_statute_links enable ROW level security;

ALTER TABLE public.risk_register enable ROW level security;

ALTER TABLE public.case_score_overrides enable ROW level security;

DROP POLICY if EXISTS "case_scores_by_org" ON public.case_scores;

CREATE POLICY "case_scores_by_org" ON public.case_scores FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS "case_treatments_by_org" ON public.case_treatments;

CREATE POLICY "case_treatments_by_org" ON public.case_treatments FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS "case_statute_links_by_org" ON public.case_statute_links;

CREATE POLICY "case_statute_links_by_org" ON public.case_statute_links FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS "risk_register_read" ON public.risk_register;

CREATE POLICY "risk_register_read" ON public.risk_register FOR
SELECT
  USING (
    (org_id IS NULL)
    OR public.is_org_member (org_id)
  );

DROP POLICY if EXISTS "risk_register_write" ON public.risk_register;

CREATE POLICY "risk_register_write" ON public.risk_register FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS "case_score_overrides_by_org" ON public.case_score_overrides;

CREATE POLICY "case_score_overrides_by_org" ON public.case_score_overrides FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
