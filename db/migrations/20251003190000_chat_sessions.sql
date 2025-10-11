create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  agent_name text not null,
  channel text not null check (channel in ('web','voice')),
  status text not null default 'active' check (status in ('active','ended')),
  chatkit_session_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists chat_sessions_org_idx on chat_sessions (org_id);
create index if not exists chat_sessions_status_idx on chat_sessions (status);
create index if not exists chat_sessions_created_idx on chat_sessions (created_at);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','agent','system')),
  content text not null,
  attachments jsonb,
  tool_invocation_id text,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx on chat_messages (session_id);
create index if not exists chat_messages_created_idx on chat_messages (created_at);

create table if not exists chat_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  actor_type text,
  actor_id text,
  created_at timestamptz not null default now()
);

create index if not exists chat_events_session_idx on chat_events (session_id);
create index if not exists chat_events_type_idx on chat_events (event_type);

alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table chat_events enable row level security;

create policy if not exists chat_sessions_service_role_full_access on chat_sessions
  for all
  using (auth.role() = 'service_role');

create policy if not exists chat_messages_service_role_full_access on chat_messages
  for all
  using (auth.role() = 'service_role');

create policy if not exists chat_events_service_role_full_access on chat_events
  for all
  using (auth.role() = 'service_role');
