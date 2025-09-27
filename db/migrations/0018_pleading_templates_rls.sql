alter table public.pleading_templates enable row level security;

create policy if not exists "templates readable"
  on public.pleading_templates
  for select using (
    org_id is null or public.is_org_member(org_id)
  );

create policy if not exists "templates manageable"
  on public.pleading_templates
  for all using (
    org_id is null or public.is_org_member(org_id)
  ) with check (
    org_id is null or public.is_org_member(org_id)
  );
