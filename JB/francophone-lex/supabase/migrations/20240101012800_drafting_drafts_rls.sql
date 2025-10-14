alter table public.drafting_drafts enable row level security;

drop policy if exists drafting_drafts_select on public.drafting_drafts;
create policy drafting_drafts_select on public.drafting_drafts
for select using (public.is_org_member(org_id));

drop policy if exists drafting_drafts_modify on public.drafting_drafts;
create policy drafting_drafts_modify on public.drafting_drafts
for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
