ALTER TABLE public.document_summaries enable ROW level security;

DROP POLICY if EXISTS "summaries_by_org" ON public.document_summaries;

CREATE POLICY "summaries_by_org" ON public.document_summaries FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
