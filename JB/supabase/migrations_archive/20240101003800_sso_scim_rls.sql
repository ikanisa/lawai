alter table public.sso_connections enable row level security;
alter table public.scim_tokens enable row level security;
alter table public.ip_allowlist_entries enable row level security;

drop policy if exists sso_connections_manage on public.sso_connections;
create policy sso_connections_manage on public.sso_connections
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists scim_tokens_manage on public.scim_tokens;
create policy scim_tokens_manage on public.scim_tokens
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists ip_allowlist_manage on public.ip_allowlist_entries;
create policy ip_allowlist_manage on public.ip_allowlist_entries
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
