-- Historical performance baselines for latency and quality metrics
create table if not exists public.performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  window_label text not null,
  collected_at timestamptz not null default now(),
  total_runs bigint not null default 0,
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

create index if not exists performance_snapshots_org_idx on public.performance_snapshots(org_id);
create index if not exists performance_snapshots_window_idx on public.performance_snapshots(window_label);
