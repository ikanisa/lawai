alter table public.document_summaries enable row level security;

drop policy if exists "summaries_by_org" on public.document_summaries;
create policy "summaries_by_org" on public.document_summaries
for all using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));
