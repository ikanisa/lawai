create table if not exists public.orchestrator_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  chat_session_id uuid references public.chat_sessions(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  director_state jsonb not null default '{}'::jsonb,
  safety_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  current_objective text,
  last_director_run_id uuid references public.agent_runs(id) on delete set null,
  last_safety_run_id uuid references public.agent_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists orchestrator_sessions_org_idx on public.orchestrator_sessions (org_id, created_at desc);
create index if not exists orchestrator_sessions_chat_idx on public.orchestrator_sessions (chat_session_id);

create trigger set_orchestrator_sessions_updated_at
  before update on public.orchestrator_sessions
  for each row
  execute procedure public.set_updated_at();

create table if not exists public.orchestrator_commands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.orchestrator_sessions(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  command_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority integer not null default 100,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  result jsonb,
  last_error text,
  notes jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orchestrator_commands_org_status_idx
  on public.orchestrator_commands (org_id, status, scheduled_for);

create index if not exists orchestrator_commands_session_idx
  on public.orchestrator_commands (session_id, scheduled_for);

create trigger set_orchestrator_commands_updated_at
  before update on public.orchestrator_commands
  for each row
  execute procedure public.set_updated_at();

create table if not exists public.orchestrator_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  command_id uuid not null references public.orchestrator_commands(id) on delete cascade,
  worker text not null default 'director' check (worker in ('director', 'safety', 'domain')),
  domain_agent text,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orchestrator_jobs_org_worker_idx
  on public.orchestrator_jobs (org_id, worker, status, scheduled_at);

create index if not exists orchestrator_jobs_command_idx
  on public.orchestrator_jobs (command_id);

create trigger set_orchestrator_jobs_updated_at
  before update on public.orchestrator_jobs
  for each row
  execute procedure public.set_updated_at();

create table if not exists public.org_connectors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connector_type text not null check (connector_type in ('erp', 'tax', 'accounting', 'compliance', 'analytics')),
  name text not null,
  status text not null default 'inactive' check (status in ('inactive', 'pending', 'active', 'error')),
  config jsonb not null default '{}'::jsonb,
  secrets jsonb default null,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists org_connectors_org_type_name_idx
  on public.org_connectors (org_id, connector_type, name);

create trigger set_org_connectors_updated_at
  before update on public.org_connectors
  for each row
  execute procedure public.set_updated_at();

alter table public.orchestrator_sessions enable row level security;
alter table public.orchestrator_commands enable row level security;
alter table public.orchestrator_jobs enable row level security;
alter table public.org_connectors enable row level security;

drop policy if exists orchestrator_sessions_service_role on public.orchestrator_sessions;
create policy orchestrator_sessions_service_role on public.orchestrator_sessions
  for all using (auth.role() = 'service_role');

drop policy if exists orchestrator_sessions_org_access on public.orchestrator_sessions;
create policy orchestrator_sessions_org_access on public.orchestrator_sessions
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists orchestrator_commands_service_role on public.orchestrator_commands;
create policy orchestrator_commands_service_role on public.orchestrator_commands
  for all using (auth.role() = 'service_role');

drop policy if exists orchestrator_commands_org_access on public.orchestrator_commands;
create policy orchestrator_commands_org_access on public.orchestrator_commands
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists orchestrator_jobs_service_role on public.orchestrator_jobs;
create policy orchestrator_jobs_service_role on public.orchestrator_jobs
  for all using (auth.role() = 'service_role');

drop policy if exists orchestrator_jobs_org_access on public.orchestrator_jobs;
create policy orchestrator_jobs_org_access on public.orchestrator_jobs
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists org_connectors_service_role on public.org_connectors;
create policy org_connectors_service_role on public.org_connectors
  for all using (auth.role() = 'service_role');

drop policy if exists org_connectors_org_access on public.org_connectors;
create policy org_connectors_org_access on public.org_connectors
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

grant select, insert, update, delete on public.orchestrator_sessions to authenticated;
grant select, insert, update, delete on public.orchestrator_commands to authenticated;
grant select, insert, update, delete on public.orchestrator_jobs to authenticated;
grant select, insert, update, delete on public.org_connectors to authenticated;

create or replace function public.enqueue_orchestrator_command(
  p_org_id uuid,
  p_session_id uuid,
  p_command_type text,
  p_payload jsonb default '{}'::jsonb,
  p_created_by uuid default null,
  p_priority integer default 100,
  p_scheduled_for timestamptz default null,
  p_worker text default 'director'
)
returns uuid
language plpgsql
as $$
declare
  v_session_id uuid := p_session_id;
  v_command_id uuid;
  v_worker text := coalesce(p_worker, 'director');
  v_schedule timestamptz := coalesce(p_scheduled_for, now());
begin
  if v_session_id is null then
    insert into public.orchestrator_sessions (org_id, created_by)
    values (p_org_id, p_created_by)
    returning id into v_session_id;
  end if;

  insert into public.orchestrator_commands (
    org_id,
    session_id,
    created_by,
    command_type,
    payload,
    priority,
    scheduled_for
  ) values (
    p_org_id,
    v_session_id,
    p_created_by,
    p_command_type,
    coalesce(p_payload, '{}'::jsonb),
    greatest(1, coalesce(p_priority, 100)),
    v_schedule
  ) returning id into v_command_id;

  insert into public.orchestrator_jobs (
    org_id,
    command_id,
    worker,
    status,
    scheduled_at
  ) values (
    p_org_id,
    v_command_id,
    v_worker,
    'pending',
    v_schedule
  );

  return v_command_id;
end;
$$;

create or replace function public.register_org_connector(
  p_org_id uuid,
  p_connector_type text,
  p_name text,
  p_config jsonb default '{}'::jsonb,
  p_status text default 'pending',
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.org_connectors (
    org_id,
    connector_type,
    name,
    config,
    status,
    metadata,
    created_by
  ) values (
    p_org_id,
    p_connector_type,
    p_name,
    coalesce(p_config, '{}'::jsonb),
    coalesce(p_status, 'pending'),
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  )
  on conflict (org_id, connector_type, name)
  do update set
    config = excluded.config,
    status = excluded.status,
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

comment on table public.orchestrator_sessions is 'State container for multi-agent orchestration sessions (Director + Safety).';
comment on table public.orchestrator_commands is 'Commands queued by the Director for domain agents or safety reviews.';
comment on table public.orchestrator_jobs is 'Asynchronous jobs spawned by orchestrator commands, consumed by workers (Director, Safety, domain agents).';
comment on table public.org_connectors is 'External ERP/Tax/Accounting connectors registered per organisation for orchestrator use.';
