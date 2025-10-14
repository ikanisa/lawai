alter table public.compliance_assessments enable row level security;

create policy if not exists "compliance assessments by org" on public.compliance_assessments
for all
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));
