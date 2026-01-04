-- Enforce residency-aware prefixes and org policy checks on storage buckets
create or replace function public.org_residency_allows(org_uuid uuid, zone text)
returns boolean
language sql
stable
as $$
  with policy as (
    select value from public.org_policies where org_id = org_uuid and key = 'residency_zone'
  )
  select case
    when zone is null then false
    when not public.storage_residency_allowed(zone) then false
    when not exists(select 1 from policy) then true
    when jsonb_typeof((select value from policy)) = 'object' then
      lower((select value ->> 'code' from policy)) = lower(zone)
    when jsonb_typeof((select value from policy)) = 'array' then
      exists(select 1 from jsonb_array_elements_text((select value from policy)) elem where lower(elem) = lower(zone))
    else true
  end;
$$;

alter policy "Org members read authorities" on storage.objects
  using (
    bucket_id = 'authorities'
    and public.storage_object_org(name) is not null
    and public.storage_object_residency(name) is not null
    and public.org_residency_allows(public.storage_object_org(name), public.storage_object_residency(name))
    and public.is_org_member(public.storage_object_org(name))
  );

alter policy "Org members upload authorities" on storage.objects
  with check (
    bucket_id = 'authorities'
    and public.storage_object_org(name) is not null
    and public.storage_object_residency(name) is not null
    and public.org_residency_allows(public.storage_object_org(name), public.storage_object_residency(name))
    and public.is_org_member(public.storage_object_org(name))
  );

alter policy "Org members manage authorities" on storage.objects
  using (
    bucket_id = 'authorities'
    and public.storage_object_org(name) is not null
    and public.storage_object_residency(name) is not null
    and public.org_residency_allows(public.storage_object_org(name), public.storage_object_residency(name))
    and public.is_org_member(public.storage_object_org(name))
  )
  with check (
    bucket_id = 'authorities'
    and public.storage_object_org(name) is not null
    and public.storage_object_residency(name) is not null
    and public.org_residency_allows(public.storage_object_org(name), public.storage_object_residency(name))
    and public.is_org_member(public.storage_object_org(name))
  );

alter policy "Org members write uploads" on storage.objects
  using (
    bucket_id = 'uploads'
    and public.storage_object_org(name) is not null
    and public.storage_object_residency(name) is not null
    and public.org_residency_allows(public.storage_object_org(name), public.storage_object_residency(name))
    and public.is_org_member(public.storage_object_org(name))
  )
  with check (
    bucket_id = 'uploads'
    and public.storage_object_org(name) is not null
    and public.storage_object_residency(name) is not null
    and public.org_residency_allows(public.storage_object_org(name), public.storage_object_residency(name))
    and public.is_org_member(public.storage_object_org(name))
  );

alter policy "Org members manage snapshots" on storage.objects
  using (
    bucket_id = 'snapshots'
    and public.storage_object_org(name) is not null
    and public.storage_object_residency(name) is not null
    and public.org_residency_allows(public.storage_object_org(name), public.storage_object_residency(name))
    and public.is_org_member(public.storage_object_org(name))
  )
  with check (
    bucket_id = 'snapshots'
    and public.storage_object_org(name) is not null
    and public.storage_object_residency(name) is not null
    and public.org_residency_allows(public.storage_object_org(name), public.storage_object_residency(name))
    and public.is_org_member(public.storage_object_org(name))
  );
