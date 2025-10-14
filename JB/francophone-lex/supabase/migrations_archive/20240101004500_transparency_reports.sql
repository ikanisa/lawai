-- Stores generated regulator-facing transparency reports
create table if not exists public.transparency_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  generated_by uuid not null,
  period_start date not null,
  period_end date not null,
  generated_at timestamptz not null default now(),
  metrics jsonb not null,
  cepej_summary jsonb,
  distribution_status text not null default 'draft'
);

create index if not exists transparency_reports_org_idx on public.transparency_reports (org_id, period_end desc);
