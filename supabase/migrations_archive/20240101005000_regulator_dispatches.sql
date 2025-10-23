CREATE TABLE IF NOT EXISTS public.regulator_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  report_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  payload_url text,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz
);

CREATE INDEX if NOT EXISTS regulator_dispatches_org_period_idx ON public.regulator_dispatches (org_id, period_start, period_end);
