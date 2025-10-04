alter table public.red_team_findings enable row level security;

create policy red_team_findings_select on public.red_team_findings
for select using (public.is_org_member(org_id));

create policy red_team_findings_modify on public.red_team_findings
for all using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));
