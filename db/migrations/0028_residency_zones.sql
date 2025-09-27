-- Residency zones to enforce storage partitioning
create table if not exists public.residency_zones (
  code text primary key,
  description text not null
);

insert into public.residency_zones (code, description) values
  ('eu', 'Union européenne / EEE'),
  ('ohada', 'OHADA - Afrique de l\'Ouest et Centrale'),
  ('ch', 'Suisse (cantons francophones)'),
  ('ca', 'Canada / Québec'),
  ('rw', 'Rwanda (gazette et justice)'),
  ('maghreb', 'Maghreb francophone (Maroc, Tunisie, Algérie)')
on conflict (code) do update set description = excluded.description;

create or replace function public.storage_object_residency(path text)
returns text
language plpgsql
immutable
as $$
declare
  second_segment text;
begin
  if path is null then
    return null;
  end if;

  second_segment := split_part(path, '/', 2);
  if second_segment is null or second_segment = '' then
    return null;
  end if;

  return lower(second_segment);
end;
$$;

create or replace function public.storage_residency_allowed(code text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.residency_zones rz where rz.code = lower($1)
  );
$$;
