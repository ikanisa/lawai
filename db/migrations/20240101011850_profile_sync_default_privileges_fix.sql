-- Ensure profiles sync keeps legacy user_id populated and tighten default grants.
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth () returns trigger language plpgsql security definer
SET
  search_path = public AS $$
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
ALTER DEFAULT PRIVILEGES IN schema public
REVOKE
SELECT
  ON tables
FROM
  anon;

ALTER DEFAULT PRIVILEGES IN schema public
REVOKE
SELECT
,
  insert,
UPDATE,
delete ON tables
FROM
  authenticated;

ALTER DEFAULT PRIVILEGES IN schema public
REVOKE usage,
SELECT
  ON sequences
FROM
  authenticated;

ALTER DEFAULT PRIVILEGES IN schema public
REVOKE usage,
SELECT
  ON sequences
FROM
  anon;

-- Keep elevated access for internal automation.
ALTER DEFAULT PRIVILEGES IN schema public
GRANT ALL ON tables TO service_role;

ALTER DEFAULT PRIVILEGES IN schema public
GRANT usage,
SELECT
  ON sequences TO service_role;
