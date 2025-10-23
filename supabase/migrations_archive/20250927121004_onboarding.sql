-- Sync auth.users metadata into public.profiles automatically.
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth () returns trigger language plpgsql security definer
SET
  search_path = public AS $$
begin
  insert into public.profiles (id, full_name, preferred_language, role, organisation, timezone, metadata)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'fr'),
    coalesce(new.raw_user_meta_data ->> 'role', 'client'),
    new.raw_user_meta_data ->> 'organisation',
    coalesce(new.raw_user_meta_data ->> 'timezone', 'Europe/Paris'),
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        preferred_language = excluded.preferred_language,
        role = excluded.role,
        organisation = excluded.organisation,
        timezone = excluded.timezone,
        metadata = excluded.metadata,
        updated_at = now();

  return new;
end;
$$;

CREATE TRIGGER sync_profile_on_auth_user
AFTER insert
OR
UPDATE ON auth.users FOR each ROW
EXECUTE procedure public.sync_profile_from_auth ();
