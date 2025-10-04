-- Sync auth.users metadata into public.profiles automatically.


create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

drop trigger if exists sync_profile_on_auth_user on auth.users;

create trigger sync_profile_on_auth_user
  after insert or update on auth.users
  for each row
  execute function public.sync_profile_from_auth();
