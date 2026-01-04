alter table public.transparency_reports enable row level security;

drop policy if exists "transparency reports by org" on public.transparency_reports;
create policy "transparency reports by org" on public.transparency_reports
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));
