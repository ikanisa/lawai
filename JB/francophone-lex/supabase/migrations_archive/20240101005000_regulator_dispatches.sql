create table if not exists public.regulator_dispatches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  payload_url text,
  status text not null default 'draft',
  metadata jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz
);

create index if not exists regulator_dispatches_org_period_idx
  on public.regulator_dispatches (org_id, period_start, period_end);
