create unique index if not exists consent_events_unique
  on public.consent_events(org_id, user_id, consent_type);

create or replace function public.record_consent_events(events jsonb)
returns setof public.consent_events
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb := coalesce(events, '[]'::jsonb);
begin
  if jsonb_typeof(payload) <> 'array' then
    raise exception 'events payload must be an array';
  end if;

  return query
  with input_rows as (
    select
      case
        when value ? 'org_id' and value->>'org_id' <> '' then (value->>'org_id')::uuid
        else null
      end as org_id,
      (value->>'user_id')::uuid as user_id,
      value->>'consent_type' as consent_type,
      value->>'version' as version
    from jsonb_array_elements(payload) as value
    where value ? 'user_id' and value ? 'consent_type' and value ? 'version'
  ),
  upserted as (
    insert into public.consent_events (org_id, user_id, consent_type, version)
    select org_id, user_id, consent_type, version
    from input_rows
    where user_id is not null and consent_type is not null and version is not null
    on conflict (org_id, user_id, consent_type)
      do update set version = excluded.version, created_at = now()
    returning *
  )
  select * from upserted;
end;
$$;
