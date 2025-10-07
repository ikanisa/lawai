-- Agent learning, telemetry, and task orchestration tables
create table if not exists public.agent_policy_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  version text,
  input_schema jsonb,
  output_schema jsonb,
  timeout_ms integer,
  max_retries integer,
  risk_level text,
  allow_domains text[],
  created_at timestamptz not null default now()
);

create unique index if not exists agent_tools_name_version_idx on public.agent_tools (name, coalesce(version, ''));

create table if not exists public.agent_synonyms (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null,
  term text not null,
  expansions text[] not null default array[]::text[],
  created_at timestamptz not null default now()
);

create unique index if not exists agent_synonyms_juris_term_idx on public.agent_synonyms (jurisdiction, term);

create table if not exists public.agent_learning_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  error text
);

create index if not exists agent_learning_jobs_status_idx on public.agent_learning_jobs (status);
create index if not exists agent_learning_jobs_org_idx on public.agent_learning_jobs (org_id);

create table if not exists public.agent_task_queue (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  org_id uuid references public.organizations(id) on delete cascade,
  payload jsonb,
  priority integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error text
);

create index if not exists agent_task_queue_status_priority_idx on public.agent_task_queue (status, priority desc, created_at);
create index if not exists agent_task_queue_org_idx on public.agent_task_queue (org_id);

create table if not exists public.tool_telemetry (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete cascade,
  tool_name text not null,
  latency_ms integer not null,
  success boolean not null,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists tool_telemetry_run_idx on public.tool_telemetry (run_id);
create index if not exists tool_telemetry_org_idx on public.tool_telemetry (org_id);

alter table public.agent_policy_versions enable row level security;
alter table public.agent_tools enable row level security;
alter table public.agent_synonyms enable row level security;
alter table public.agent_learning_jobs enable row level security;
alter table public.agent_task_queue enable row level security;
alter table public.tool_telemetry enable row level security;

create policy if not exists agent_policy_versions_read on public.agent_policy_versions
for select using (true);

create policy if not exists agent_tools_read on public.agent_tools
for select using (true);

create policy if not exists agent_synonyms_read on public.agent_synonyms
for select using (true);

create policy if not exists agent_learning_jobs_policy on public.agent_learning_jobs
for all using (org_id is null or public.is_org_member(org_id))
  with check (org_id is null or public.is_org_member(org_id));

create policy if not exists agent_task_queue_policy on public.agent_task_queue
for all using (org_id is null or public.is_org_member(org_id))
  with check (org_id is null or public.is_org_member(org_id));

create policy if not exists tool_telemetry_policy on public.tool_telemetry
for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
