alter table public.slo_snapshots enable row level security;

drop policy if exists "slo snapshots view" on public.slo_snapshots;
create policy "slo snapshots view" on public.slo_snapshots
  for select using (public.is_org_member(org_id));

drop policy if exists "slo snapshots manage" on public.slo_snapshots;
create policy "slo snapshots manage" on public.slo_snapshots
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
