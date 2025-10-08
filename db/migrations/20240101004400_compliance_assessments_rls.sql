alter table public.compliance_assessments enable row level security;

drop policy if exists "compliance assessments by org" on public.compliance_assessments;
create policy "compliance assessments by org" on public.compliance_assessments
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));
