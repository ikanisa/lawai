-- Store nightly drift and evaluation summaries
create table if not exists public.agent_learning_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('drift', 'evaluation')),
  report_date date not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (org_id, kind, report_date)
);

alter table public.agent_learning_reports enable row level security;

drop policy if exists "learning reports by org" on public.agent_learning_reports;
create policy "learning reports by org" on public.agent_learning_reports
  for select using (public.is_org_member(org_id));
