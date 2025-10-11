create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  session_token text not null,
  device_fingerprint text not null,
  device_label text,
  user_agent text,
  platform text,
  client_version text,
  ip_address inet,
  auth_strength text,
  mfa_method text,
  attested boolean,
  passkey boolean,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_reason text
);

alter table public.device_sessions
  add constraint device_sessions_org_session_token_unique unique (org_id, session_token);

create index if not exists device_sessions_org_last_seen_idx on public.device_sessions (org_id, last_seen_at desc);
create index if not exists device_sessions_user_last_seen_idx on public.device_sessions (user_id, last_seen_at desc);
create index if not exists device_sessions_fingerprint_idx on public.device_sessions (device_fingerprint);

alter table public.device_sessions enable row level security;

drop policy if exists device_sessions_service_role_access on public.device_sessions;
create policy device_sessions_service_role_access on public.device_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists device_sessions_org_read on public.device_sessions;
create policy device_sessions_org_read on public.device_sessions
  for select
  using (public.is_org_member(org_id));

drop policy if exists device_sessions_org_write on public.device_sessions;
create policy device_sessions_org_write on public.device_sessions
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
