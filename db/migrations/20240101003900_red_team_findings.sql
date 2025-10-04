-- Red-team findings registry for compliance and security reviews
create table if not exists public.red_team_findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  scenario_key text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  expected_outcome text not null,
  observed_outcome text not null,
  passed boolean not null,
  summary text not null,
  detail jsonb,
  mitigations text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'accepted_risk')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  created_by uuid not null,
  updated_at timestamptz not null default now()
);

create index if not exists red_team_findings_org_idx on public.red_team_findings(org_id);
create index if not exists red_team_findings_status_idx on public.red_team_findings(status);
create index if not exists red_team_findings_scenario_idx on public.red_team_findings(scenario_key);
