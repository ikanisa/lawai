-- Ensure profiles sync keeps legacy user_id populated and tighten default grants.

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    user_id,
    full_name,
    preferred_language,
    role,
    organisation,
    timezone,
    metadata
  )
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'fr'),
    coalesce(new.raw_user_meta_data ->> 'role', 'client'),
    new.raw_user_meta_data ->> 'organisation',
    coalesce(new.raw_user_meta_data ->> 'timezone', 'Europe/Paris'),
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
  )
  on conflict (id) do update
    set user_id = excluded.user_id,
        full_name = excluded.full_name,
        preferred_language = excluded.preferred_language,
        role = excluded.role,
        organisation = excluded.organisation,
        timezone = excluded.timezone,
        metadata = excluded.metadata,
        updated_at = now();

  return new;
end;
$$;

-- Harden default privileges so new tables do not become world-readable by default.
alter default privileges in schema public
  revoke select on tables from anon;

alter default privileges in schema public
  revoke select, insert, update, delete on tables from authenticated;

alter default privileges in schema public
  revoke usage, select on sequences from authenticated;

alter default privileges in schema public
  revoke usage, select on sequences from anon;

-- Keep elevated access for internal automation.
alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;
