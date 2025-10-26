ALTER TABLE public.drafting_drafts enable ROW level security;

DROP POLICY if EXISTS drafting_drafts_select ON public.drafting_drafts;

CREATE POLICY drafting_drafts_select ON public.drafting_drafts FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS drafting_drafts_modify ON public.drafting_drafts;

CREATE POLICY drafting_drafts_modify ON public.drafting_drafts FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
