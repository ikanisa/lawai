-- Enterprise SSO and SCIM tables plus profile enhancements
alter table public.profiles
  add column if not exists email text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.sso_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('saml','oidc')),
  label text,
  metadata jsonb not null default '{}'::jsonb,
  acs_url text,
  entity_id text,
  client_id text,
  client_secret text,
  default_role text not null default 'member' check (default_role in (
    'owner','admin','member','reviewer','viewer','compliance_officer','auditor'
  )),
  group_mappings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create index if not exists sso_connections_org_idx on public.sso_connections(org_id);

create table if not exists public.scim_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  token_hash text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz
);

create unique index if not exists scim_tokens_hash_idx on public.scim_tokens(token_hash);

create table if not exists public.ip_allowlist_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  cidr text not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists ip_allowlist_org_idx on public.ip_allowlist_entries(org_id);
