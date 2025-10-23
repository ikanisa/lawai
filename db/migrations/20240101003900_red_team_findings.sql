-- Red-team findings registry for compliance and security reviews
CREATE TABLE IF NOT EXISTS public.red_team_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  scenario_key text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  expected_outcome text NOT NULL,
  observed_outcome text NOT NULL,
  passed boolean NOT NULL,
  summary text NOT NULL,
  detail jsonb,
  mitigations text,
  status text NOT NULL DEFAULT 'open' CHECK (
    status IN (
      'open',
      'in_progress',
      'resolved',
      'accepted_risk'
    )
  ),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  created_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS red_team_findings_org_idx ON public.red_team_findings (org_id);

CREATE INDEX if NOT EXISTS red_team_findings_status_idx ON public.red_team_findings (status);

CREATE INDEX if NOT EXISTS red_team_findings_scenario_idx ON public.red_team_findings (scenario_key);
