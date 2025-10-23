-- Create service-level objective snapshot storage
CREATE TABLE IF NOT EXISTS public.slo_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  api_uptime_percent numeric(5, 2) NOT NULL,
  hitl_response_p95_seconds numeric(6, 2) NOT NULL,
  retrieval_latency_p95_seconds numeric(6, 2) NOT NULL,
  citation_precision_p95 numeric(5, 2),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
