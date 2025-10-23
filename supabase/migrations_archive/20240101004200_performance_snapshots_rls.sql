ALTER TABLE public.performance_snapshots enable ROW level security;

CREATE POLICY performance_snapshots_select ON public.performance_snapshots FOR
SELECT
  USING (public.is_org_member (org_id));

CREATE POLICY performance_snapshots_modify ON public.performance_snapshots FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
