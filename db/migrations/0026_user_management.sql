-- Extend roles and add enterprise user-management tables
alter table public.org_members
  drop constraint if exists org_members_role_check;

alter table public.org_members
  add constraint org_members_role_check
  check (role in ('owner','admin','member','reviewer','viewer','compliance_officer','auditor'));

alter table public.profiles
  add column if not exists professional_type text,
  add column if not exists bar_number text,
  add column if not exists court_id text,
  add column if not exists verified boolean not null default false;

create table if not exists public.org_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, key)
);

create table if not exists public.jurisdiction_entitlements (
  org_id uuid not null references public.organizations(id) on delete cascade,
  juris_code text not null,
  can_read boolean not null default false,
  can_write boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, juris_code)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid,
  kind text not null,
  object text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  consent_type text not null,
  version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  token uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','admin','member','reviewer','viewer','compliance_officer','auditor')),
  expires_at timestamptz not null,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_accounts (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null,
  seats int not null default 0,
  metering jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
