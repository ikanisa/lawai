-- Compliance assessment snapshot per agent run
create table if not exists public.compliance_assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  fria_required boolean not null default false,
  fria_reasons text[] not null default array[]::text[],
  cepej_passed boolean not null default true,
  cepej_violations text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  unique (run_id)
);
