-- Stores generated regulator-facing transparency reports
CREATE TABLE IF NOT EXISTS public.transparency_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  generated_by uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  metrics jsonb NOT NULL,
  cepej_summary jsonb,
  distribution_status text NOT NULL DEFAULT 'draft'
);

CREATE INDEX if NOT EXISTS transparency_reports_org_idx ON public.transparency_reports (org_id, period_end DESC);
