-- Residency zones to enforce storage partitioning
CREATE TABLE IF NOT EXISTS public.residency_zones (code text PRIMARY KEY, description text NOT NULL);

INSERT INTO
  public.residency_zones (code, description)
VALUES
  ('eu', 'Union européenne / EEE'),
  (
    'ohada',
    'OHADA - Afrique de l''Ouest et Centrale'
  ),
  ('ch', 'Suisse (cantons francophones)'),
  ('ca', 'Canada / Québec'),
  ('rw', 'Rwanda (gazette et justice)'),
  (
    'maghreb',
    'Maghreb francophone (Maroc, Tunisie, Algérie)'
  )
ON CONFLICT (code) DO UPDATE
SET
  description = excluded.description;

CREATE OR REPLACE FUNCTION public.storage_object_residency (path text) returns text language plpgsql immutable AS $$
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

CREATE OR REPLACE FUNCTION public.storage_residency_allowed (code text) returns boolean language sql stable AS $$
  select exists (
    select 1 from public.residency_zones rz where rz.code = lower($1)
  );
$$;
