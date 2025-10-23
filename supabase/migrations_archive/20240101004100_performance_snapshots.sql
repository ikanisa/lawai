-- Historical performance baselines for latency and quality metrics
CREATE TABLE IF NOT EXISTS public.performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  window_label text NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  total_runs bigint NOT NULL DEFAULT 0,
  avg_latency_ms numeric,
  p95_latency_ms numeric,
  allowlisted_ratio numeric,
  hitl_median_minutes numeric,
  citation_precision numeric,
  temporal_validity numeric,
  binding_warnings integer,
  notes text,
  recorded_by uuid,
  metadata jsonb
);

CREATE INDEX if NOT EXISTS performance_snapshots_org_idx ON public.performance_snapshots (org_id);

CREATE INDEX if NOT EXISTS performance_snapshots_window_idx ON public.performance_snapshots (window_label);
