alter table public.sso_connections enable row level security;
alter table public.scim_tokens enable row level security;
alter table public.ip_allowlist_entries enable row level security;

create policy if not exists sso_connections_manage on public.sso_connections
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy if not exists scim_tokens_manage on public.scim_tokens
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy if not exists ip_allowlist_manage on public.ip_allowlist_entries
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
