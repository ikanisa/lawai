-- Extend organizations metadata
alter table public.organizations
  add column if not exists plan text default 'standard',
  add column if not exists compliance_profile jsonb default '{}'::jsonb,
  add column if not exists residency_zone text default 'eu';

-- Extend profiles with contact and professional metadata
alter table public.profiles
  add column if not exists email text,
  add column if not exists phone_e164 text,
  add column if not exists professional_type text,
  add column if not exists bar_number text,
  add column if not exists verified boolean default false;

create index if not exists idx_profiles_email on public.profiles(lower(email));
create index if not exists idx_profiles_phone on public.profiles(phone_e164);

-- Update org member roles to support RBAC matrix
alter table public.org_members
  drop constraint if exists org_members_role_check;

alter table public.org_members
  add constraint org_members_role_check
    check (role in ('owner','admin','reviewer','member','viewer','compliance_officer','auditor'));

-- Org policies table
create table if not exists public.org_policies (
  org_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);

alter table public.org_policies enable row level security;

drop policy if exists "org_policies_r" on public.org_policies;
drop policy if exists "org_policies_rw" on public.org_policies;
drop policy if exists "org_policies_access" on public.org_policies;

create policy "org_policies_access" on public.org_policies
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- Jurisdiction entitlements
create table if not exists public.jurisdiction_entitlements (
  org_id uuid not null references public.organizations(id) on delete cascade,
  juris_code text not null,
  can_read boolean not null default true,
  can_write boolean not null default false,
  primary key (org_id, juris_code)
);

alter table public.jurisdiction_entitlements enable row level security;

drop policy if exists "juris_entitlements_rw" on public.jurisdiction_entitlements;
drop policy if exists "juris_entitlements_access" on public.jurisdiction_entitlements;

create policy "juris_entitlements_access" on public.jurisdiction_entitlements
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- Invitations table
create table if not exists public.invitations (
  token uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text,
  role text not null check (role in ('owner','admin','reviewer','member','viewer','compliance_officer','auditor')),
  expires_at timestamptz not null,
  accepted_by uuid,
  created_at timestamptz not null default now()
);

alter table public.invitations enable row level security;

drop policy if exists "invitations_access" on public.invitations;

create policy "invitations_access" on public.invitations
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create index if not exists idx_invitations_email on public.invitations(lower(email));

-- Consent events table
create table if not exists public.consent_events (
  user_id uuid not null,
  org_id uuid references public.organizations(id) on delete cascade,
  type text not null,
  version text not null,
  created_at timestamptz not null default now()
);

alter table public.consent_events enable row level security;

drop policy if exists "consent_events_access" on public.consent_events;

create policy "consent_events_access" on public.consent_events
  for all
  using (
    auth.uid() = user_id
    or (org_id is not null and public.is_org_member(org_id))
  )
  with check (
    auth.uid() = user_id
    or (org_id is not null and public.is_org_member(org_id))
  );

create index if not exists idx_consent_user on public.consent_events(user_id);
create index if not exists idx_consent_org on public.consent_events(org_id);

-- Audit events table (append-only)
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid,
  kind text not null,
  object text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb,
  ts timestamptz not null default now()
);

alter table public.audit_events enable row level security;

drop policy if exists "audit_events_access" on public.audit_events;

create policy "audit_events_access" on public.audit_events
  for select
  using (public.is_org_member(org_id));

-- WhatsApp identities
create table if not exists public.wa_identities (
  wa_id text primary key,
  phone_e164 text not null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_wa_phone on public.wa_identities(phone_e164);
create index if not exists idx_wa_user on public.wa_identities(user_id);

alter table public.wa_identities enable row level security;

drop policy if exists "wa_identities_access" on public.wa_identities;

create policy "wa_identities_access" on public.wa_identities
  for all
  using (
    user_id is null
    or auth.uid() = user_id
    or exists (
      select 1
      from public.org_members om
      where om.user_id = wa_identities.user_id
        and public.is_org_member(om.org_id)
    )
  )
  with check (
    user_id is null
    or auth.uid() = user_id
  );

-- WhatsApp OTP storage (service role access only)
create table if not exists public.wa_otp (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_wa_otp_phone on public.wa_otp(phone_e164);
create index if not exists idx_wa_otp_expiry on public.wa_otp(expires_at);

alter table public.wa_otp enable row level security;

drop policy if exists "wa_otp_service_read" on public.wa_otp;
drop policy if exists "wa_otp_service_write" on public.wa_otp;
drop policy if exists "wa_otp_service" on public.wa_otp;

create policy "wa_otp_service" on public.wa_otp
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
