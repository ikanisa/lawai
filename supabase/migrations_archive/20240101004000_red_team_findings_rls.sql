ALTER TABLE public.red_team_findings enable ROW level security;

CREATE POLICY red_team_findings_select ON public.red_team_findings FOR
SELECT
  USING (public.is_org_member (org_id));

CREATE POLICY red_team_findings_modify ON public.red_team_findings FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
