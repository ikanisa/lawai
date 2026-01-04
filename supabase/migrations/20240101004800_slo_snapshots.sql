-- Create service-level objective snapshot storage
create table if not exists public.slo_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  captured_at timestamptz not null default now(),
  api_uptime_percent numeric(5,2) not null,
  hitl_response_p95_seconds numeric(6,2) not null,
  retrieval_latency_p95_seconds numeric(6,2) not null,
  citation_precision_p95 numeric(5,2),
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
