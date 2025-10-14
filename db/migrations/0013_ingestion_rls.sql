alter table public.ingestion_runs enable row level security;

create policy if not exists "ingestion runs by org" on public.ingestion_runs
  for all
  using (org_id is null or public.is_org_member(org_id))
  with check (org_id is null or public.is_org_member(org_id));

create policy if not exists "authority domains readable" on public.authority_domains
  for select
  using (true);
