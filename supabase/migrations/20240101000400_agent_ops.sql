create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  question text not null,
  jurisdiction_json jsonb,
  model text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  risk_level text check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  hitl_required boolean default false,
  irac jsonb,
  status text not null default 'completed'
);

create table if not exists public.tool_invocations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  tool_name text not null,
  args jsonb,
  output jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.run_citations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  title text,
  publisher text,
  date text,
  url text not null,
  domain_ok boolean not null default false
);

create table if not exists public.hitl_queue (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null,
  status text not null default 'pending',
  reviewer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.eval_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  prompt text not null,
  expected_contains text[],
  created_at timestamptz not null default now()
);

create table if not exists public.eval_results (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.eval_cases(id) on delete cascade,
  run_id uuid references public.agent_runs(id),
  pass boolean,
  notes text,
  created_at timestamptz not null default now()
);
