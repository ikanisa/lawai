-- Restore WhatsApp/phone contact support objects missing from production.
-- Idempotent DDL guarded with IF NOT EXISTS to avoid conflicts on re-run.

begin;

-- Ensure profiles table exposes phone numbers for OTP / WhatsApp flows.
alter table public.profiles
  add column if not exists phone_e164 text;

-- Add indexes used by account provisioning and lookup flows.
create index if not exists idx_profiles_email
  on public.profiles (lower(email));

create index if not exists idx_profiles_phone
  on public.profiles (phone_e164);

-- WhatsApp identity mapping between WhatsApp sender IDs and users.
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

-- WhatsApp OTP scratch space (service-role only).
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

drop policy if exists "wa_otp_service" on public.wa_otp;
create policy "wa_otp_service" on public.wa_otp
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

commit;
