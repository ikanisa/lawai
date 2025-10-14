-- Enforce tenant isolation for ingestion quarantine records
alter table public.ingestion_quarantine enable row level security;

create policy if not exists "quarantine_read" on public.ingestion_quarantine
  for select using (public.is_org_member(org_id));

create policy if not exists "quarantine_manage" on public.ingestion_quarantine
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
