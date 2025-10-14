-- Enforce residency prefixes in storage policies
create or replace function public.storage_object_is_valid(path text)
returns boolean
language sql
stable
as $$
  select
    public.storage_object_org(path) is not null
    and public.storage_residency_allowed(public.storage_object_residency(path));
$$;

drop policy if exists "Org members read authorities" on storage.objects;
drop policy if exists "Org members upload authorities" on storage.objects;
drop policy if exists "Org members manage authorities" on storage.objects;
drop policy if exists "Org members delete authorities" on storage.objects;
drop policy if exists "Org members read uploads" on storage.objects;
drop policy if exists "Org members write uploads" on storage.objects;
drop policy if exists "Org members manage snapshots" on storage.objects;

create policy "Org members read authorities" on storage.objects
  for select using (
    bucket_id = 'authorities'
    and public.storage_object_is_valid(name)
    and public.is_org_member(public.storage_object_org(name))
  );

create policy "Org members upload authorities" on storage.objects
  for insert with check (
    bucket_id = 'authorities'
    and public.storage_object_is_valid(name)
    and public.is_org_member(public.storage_object_org(name))
  );

create policy "Org members manage authorities" on storage.objects
  for update using (
    bucket_id = 'authorities'
    and public.storage_object_is_valid(name)
    and public.is_org_member(public.storage_object_org(name))
  )
  with check (
    bucket_id = 'authorities'
    and public.storage_object_is_valid(name)
    and public.is_org_member(public.storage_object_org(name))
  );

create policy "Org members delete authorities" on storage.objects
  for delete using (
    bucket_id = 'authorities'
    and public.storage_object_is_valid(name)
    and public.is_org_member(public.storage_object_org(name))
  );

create policy "Org members read uploads" on storage.objects
  for select using (
    bucket_id = 'uploads'
    and public.storage_object_is_valid(name)
    and public.is_org_member(public.storage_object_org(name))
  );

create policy "Org members write uploads" on storage.objects
  for all using (
    bucket_id = 'uploads'
    and public.storage_object_is_valid(name)
    and public.is_org_member(public.storage_object_org(name))
  ) with check (
    bucket_id = 'uploads'
    and public.storage_object_is_valid(name)
    and public.is_org_member(public.storage_object_org(name))
  );

create policy "Org members manage snapshots" on storage.objects
  for all using (
    bucket_id = 'snapshots'
    and public.storage_object_is_valid(name)
    and public.is_org_member(public.storage_object_org(name))
  ) with check (
    bucket_id = 'snapshots'
    and public.storage_object_is_valid(name)
    and public.is_org_member(public.storage_object_org(name))
  );
