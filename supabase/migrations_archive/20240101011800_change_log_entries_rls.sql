alter table public.change_log_entries enable row level security;

drop policy if exists change_log_entries_select on public.change_log_entries;
create policy change_log_entries_select on public.change_log_entries
  for select using (public.is_org_member(org_id));

drop policy if exists change_log_entries_modify on public.change_log_entries;
create policy change_log_entries_modify on public.change_log_entries
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
