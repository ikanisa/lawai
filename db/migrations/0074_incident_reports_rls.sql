alter table public.incident_reports enable row level security;

create policy incident_reports_select on public.incident_reports
  for select using (public.is_org_member(org_id));

create policy incident_reports_modify on public.incident_reports
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
