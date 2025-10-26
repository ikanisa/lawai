CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question text NOT NULL,
  jurisdiction_json jsonb,
  model text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  risk_level text CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  hitl_required boolean DEFAULT FALSE,
  irac jsonb,
  status text NOT NULL DEFAULT 'completed'
);

CREATE TABLE IF NOT EXISTS public.tool_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs (id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  args jsonb,
  output jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.run_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs (id) ON DELETE CASCADE,
  title text,
  publisher text,
  date text,
  url text NOT NULL,
  domain_ok boolean NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.hitl_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs (id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.eval_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  prompt text NOT NULL,
  expected_contains TEXT[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.eval_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.eval_cases (id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.agent_runs (id),
  pass boolean,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
