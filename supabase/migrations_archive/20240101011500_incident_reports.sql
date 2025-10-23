-- Incident reports captured for operational readiness
CREATE TABLE IF NOT EXISTS public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  detected_at timestamptz,
  resolved_at timestamptz,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL CHECK (status IN ('open', 'mitigated', 'closed')),
  title text NOT NULL,
  summary text,
  impact text,
  resolution text,
  follow_up text,
  evidence_url text,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS incident_reports_org_idx ON public.incident_reports (org_id, occurred_at DESC);
