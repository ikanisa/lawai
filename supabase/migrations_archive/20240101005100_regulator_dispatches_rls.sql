alter table public.regulator_dispatches enable row level security;

create policy "regulator dispatches view" on public.regulator_dispatches
  for select using (public.is_org_member(org_id));

create policy "regulator dispatches manage" on public.regulator_dispatches
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
