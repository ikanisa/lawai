alter table public.performance_snapshots enable row level security;

create policy performance_snapshots_select on public.performance_snapshots
for select using (public.is_org_member(org_id));

create policy performance_snapshots_modify on public.performance_snapshots
for all using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));
