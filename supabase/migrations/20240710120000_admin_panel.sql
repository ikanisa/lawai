-- Admin panel foundational tables
create table if not exists public.admin_policies (
  org_id text not null,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null,
  primary key (org_id, key)
);

create table if not exists public.admin_entitlements (
  org_id text not null,
  jurisdiction text not null,
  entitlement text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (org_id, jurisdiction, entitlement)
);

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  actor text not null,
  action text not null,
  object text not null,
  payload_before jsonb,
  payload_after jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  type text not null,
  status text not null default 'queued',
  progress integer not null default 0,
  last_error text,
  payload jsonb,
  actor text,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_telemetry_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  metric text not null,
  value numeric,
  collected_at timestamptz not null default now(),
  tags jsonb
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  email text not null,
  role text not null,
  capabilities text[] not null default array[]::text[],
  invited_at timestamptz not null default now(),
  last_active timestamptz,
  unique (org_id, email)
);

create table if not exists public.admin_agents (
  id text primary key,
  org_id text not null,
  name text not null,
  version text not null,
  status text not null,
  tool_count integer not null default 0,
  promoted_at timestamptz not null default now()
);

create table if not exists public.admin_workflows (
  id text primary key,
  org_id text not null,
  name text not null,
  version text not null,
  status text not null,
  draft_diff jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.admin_hitl_queue (
  id text primary key,
  org_id text not null,
  matter text not null,
  summary text,
  status text not null default 'pending',
  blast_radius integer not null default 0,
  submitted_at timestamptz not null default now()
);

create table if not exists public.admin_corpus_sources (
  id text primary key,
  org_id text not null,
  label text not null,
  status text not null,
  last_synced_at timestamptz not null default now(),
  quarantine_count integer not null default 0
);

create table if not exists public.admin_ingestion_tasks (
  id text primary key,
  org_id text not null,
  stage text not null,
  status text not null,
  progress integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_evaluations (
  id text primary key,
  org_id text not null,
  name text not null,
  pass_rate numeric not null,
  slo_gate text not null,
  status text not null default 'pass',
  last_run_at timestamptz not null default now()
);

create or replace function public.admin_actor_org() returns text language sql stable as
$$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'org_id', '');
$$;

alter table public.admin_policies enable row level security;
alter table public.admin_entitlements enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.admin_jobs enable row level security;
alter table public.admin_telemetry_snapshots enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_agents enable row level security;
alter table public.admin_workflows enable row level security;
alter table public.admin_hitl_queue enable row level security;
alter table public.admin_corpus_sources enable row level security;
alter table public.admin_ingestion_tasks enable row level security;
alter table public.admin_evaluations enable row level security;

create policy if not exists "org members read policies"
  on public.admin_policies
  for select using (admin_actor_org() = org_id);
create policy if not exists "org members write policies"
  on public.admin_policies
  for insert with check (admin_actor_org() = org_id);
create policy if not exists "org members update policies"
  on public.admin_policies
  for update using (admin_actor_org() = org_id);

create policy if not exists "org members read entitlements"
  on public.admin_entitlements
  for select using (admin_actor_org() = org_id);
create policy if not exists "org members write entitlements"
  on public.admin_entitlements
  for insert with check (admin_actor_org() = org_id);
create policy if not exists "org members update entitlements"
  on public.admin_entitlements
  for update using (admin_actor_org() = org_id);

create policy if not exists "org members read audits"
  on public.admin_audit_events
  for select using (admin_actor_org() = org_id);
create policy if not exists "org members insert audits"
  on public.admin_audit_events
  for insert with check (admin_actor_org() = org_id);

create policy if not exists "org members read jobs"
  on public.admin_jobs
  for select using (admin_actor_org() = org_id);
create policy if not exists "org members insert jobs"
  on public.admin_jobs
  for insert with check (admin_actor_org() = org_id);
create policy if not exists "org members update jobs"
  on public.admin_jobs
  for update using (admin_actor_org() = org_id);

create policy if not exists "org members read telemetry"
  on public.admin_telemetry_snapshots
  for select using (admin_actor_org() = org_id);
create policy if not exists "org members insert telemetry"
  on public.admin_telemetry_snapshots
  for insert with check (admin_actor_org() = org_id);

create policy if not exists "org members manage users"
  on public.admin_users
  using (admin_actor_org() = org_id)
  with check (admin_actor_org() = org_id);

create policy if not exists "org members manage agents"
  on public.admin_agents
  using (admin_actor_org() = org_id)
  with check (admin_actor_org() = org_id);

create policy if not exists "org members manage workflows"
  on public.admin_workflows
  using (admin_actor_org() = org_id)
  with check (admin_actor_org() = org_id);

create policy if not exists "org members manage hitl"
  on public.admin_hitl_queue
  using (admin_actor_org() = org_id)
  with check (admin_actor_org() = org_id);

create policy if not exists "org members manage corpus"
  on public.admin_corpus_sources
  using (admin_actor_org() = org_id)
  with check (admin_actor_org() = org_id);

create policy if not exists "org members manage ingestion"
  on public.admin_ingestion_tasks
  using (admin_actor_org() = org_id)
  with check (admin_actor_org() = org_id);

create policy if not exists "org members manage evaluations"
  on public.admin_evaluations
  using (admin_actor_org() = org_id)
  with check (admin_actor_org() = org_id);

create or replace function public.match_chunks(query_embedding vector(1536), match_threshold float) returns table (
  chunk_id uuid,
  score float
) language sql stable as
$$
  select id, 1 - (embedding <=> query_embedding) as score
  from public.document_chunks
  where 1 - (embedding <=> query_embedding) >= match_threshold
  order by score desc
  limit 20;
$$;

create or replace function public.domain_in_allowlist(domain text) returns boolean
language sql stable as
$$
  select exists(select 1 from public.corpus_allowlist where host = domain);
$$;
