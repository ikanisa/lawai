-- Store nightly drift and evaluation summaries
CREATE TABLE IF NOT EXISTS public.agent_learning_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('drift', 'evaluation')),
  report_date date NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, kind, report_date)
);

ALTER TABLE public.agent_learning_reports enable ROW level security;

DROP POLICY if EXISTS "learning reports by org" ON public.agent_learning_reports;

CREATE POLICY "learning reports by org" ON public.agent_learning_reports FOR
SELECT
  USING (public.is_org_member (org_id));
