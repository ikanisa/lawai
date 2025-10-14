alter table public.ingestion_runs enable row level security;

drop policy if exists "ingestion runs by org" on public.ingestion_runs;
create policy "ingestion runs by org" on public.ingestion_runs
  for all
  using (org_id is null or public.is_org_member(org_id))
  with check (org_id is null or public.is_org_member(org_id));

drop policy if exists "authority domains readable" on public.authority_domains;
create policy "authority domains readable" on public.authority_domains
  for select
  using (true);
