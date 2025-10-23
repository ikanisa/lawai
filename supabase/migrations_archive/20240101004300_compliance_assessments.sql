-- Compliance assessment snapshot per agent run
CREATE TABLE IF NOT EXISTS public.compliance_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.agent_runs (id) ON DELETE CASCADE,
  fria_required boolean NOT NULL DEFAULT FALSE,
  fria_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  cepej_passed boolean NOT NULL DEFAULT TRUE,
  cepej_violations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id)
);
