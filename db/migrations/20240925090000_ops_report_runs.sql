-- Create table to store generated ops reports
CREATE TABLE IF NOT EXISTS public.ops_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  report_kind text NOT NULL,
  requested_by uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb,
  status text DEFAULT 'completed'
);

CREATE INDEX if NOT EXISTS ops_report_runs_org_kind_idx ON public.ops_report_runs (org_id, report_kind, created_at DESC);

ALTER TABLE public.ops_report_runs enable ROW level security;

CREATE POLICY "org members can read ops report runs" ON public.ops_report_runs FOR
SELECT
  USING (
    auth.uid () = requested_by
    OR auth.role () = 'service_role'
  );

CREATE POLICY "service role can insert ops report runs" ON public.ops_report_runs FOR insert
WITH
  CHECK (auth.role () = 'service_role');
