-- Create table to store generated ops reports
create table if not exists public.ops_report_runs (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null,
    report_kind text not null,
    requested_by uuid not null,
    payload jsonb not null,
    created_at timestamptz not null default now(),
    metadata jsonb,
    status text default 'completed'
);

create index if not exists ops_report_runs_org_kind_idx on public.ops_report_runs (org_id, report_kind, created_at desc);

alter table public.ops_report_runs enable row level security;

create policy "org members can read ops report runs" on public.ops_report_runs
  for select using (auth.uid() = requested_by or auth.role() = 'service_role');

create policy "service role can insert ops report runs" on public.ops_report_runs
  for insert with check (auth.role() = 'service_role');
