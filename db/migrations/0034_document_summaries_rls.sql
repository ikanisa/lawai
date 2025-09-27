alter table public.document_summaries enable row level security;

create policy if not exists "summaries_by_org" on public.document_summaries
for all using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));
