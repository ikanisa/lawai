alter table public.regulator_dispatches enable row level security;

drop policy if exists "regulator dispatches view" on public.regulator_dispatches;
create policy "regulator dispatches view" on public.regulator_dispatches
  for select using (public.is_org_member(org_id));

drop policy if exists "regulator dispatches manage" on public.regulator_dispatches;
create policy "regulator dispatches manage" on public.regulator_dispatches
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
