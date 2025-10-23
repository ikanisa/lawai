CREATE TABLE IF NOT EXISTS public.pleading_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  jurisdiction_code text NOT NULL,
  matter_type text NOT NULL,
  title text NOT NULL,
  summary text,
  locale text NOT NULL DEFAULT 'fr',
  sections jsonb NOT NULL,
  fill_ins jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX if NOT EXISTS pleading_templates_unique ON public.pleading_templates (
  coalesce(
    org_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  jurisdiction_code,
  matter_type,
  locale
);
