ALTER TABLE public.pleading_templates enable ROW level security;

DROP POLICY if EXISTS "templates readable" ON public.pleading_templates;

CREATE POLICY "templates readable" ON public.pleading_templates FOR
SELECT
  USING (
    org_id IS NULL
    OR public.is_org_member (org_id)
  );

DROP POLICY if EXISTS "templates manageable" ON public.pleading_templates;

CREATE POLICY "templates manageable" ON public.pleading_templates FOR ALL USING (
  org_id IS NULL
  OR public.is_org_member (org_id)
)
WITH
  CHECK (
    org_id IS NULL
    OR public.is_org_member (org_id)
  );
