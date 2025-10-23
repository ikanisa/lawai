ALTER TABLE public.regulator_dispatches enable ROW level security;

CREATE POLICY "regulator dispatches view" ON public.regulator_dispatches FOR
SELECT
  USING (public.is_org_member (org_id));

CREATE POLICY "regulator dispatches manage" ON public.regulator_dispatches FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
