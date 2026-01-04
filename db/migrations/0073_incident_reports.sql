-- Incident reports captured for operational readiness
create table if not exists public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  occurred_at timestamptz not null,
  detected_at timestamptz,
  resolved_at timestamptz,
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null check (status in ('open','mitigated','closed')),
  title text not null,
  summary text,
  impact text,
  resolution text,
  follow_up text,
  evidence_url text,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now()
);

create index if not exists incident_reports_org_idx on public.incident_reports(org_id, occurred_at desc);
