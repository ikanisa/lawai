alter table public.drive_manifests enable row level security;
alter table public.drive_manifest_items enable row level security;

create policy if not exists "drive manifests readable"
  on public.drive_manifests
  for select using (
    org_id is null or public.is_org_member(org_id)
  );

create policy if not exists "drive manifests writable"
  on public.drive_manifests
  for all using (
    org_id is null or public.is_org_member(org_id)
  ) with check (
    org_id is null or public.is_org_member(org_id)
  );

create policy if not exists "drive manifest items readable"
  on public.drive_manifest_items
  for select using (
    exists(
      select 1 from public.drive_manifests dm
      where dm.id = manifest_id
        and (dm.org_id is null or public.is_org_member(dm.org_id))
    )
  );

create policy if not exists "drive manifest items writable"
  on public.drive_manifest_items
  for all using (
    exists(
      select 1 from public.drive_manifests dm
      where dm.id = manifest_id
        and (dm.org_id is null or public.is_org_member(dm.org_id))
    )
  ) with check (
    exists(
      select 1 from public.drive_manifests dm
      where dm.id = manifest_id
        and (dm.org_id is null or public.is_org_member(dm.org_id))
    )
  );
