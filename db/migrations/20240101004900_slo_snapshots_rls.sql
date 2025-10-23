ALTER TABLE public.slo_snapshots enable ROW level security;

CREATE POLICY "slo snapshots view" ON public.slo_snapshots FOR
SELECT
  USING (public.is_org_member (org_id));

CREATE POLICY "slo snapshots manage" ON public.slo_snapshots FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
