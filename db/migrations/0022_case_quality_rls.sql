-- RLS policies for case quality tables
alter table public.case_scores enable row level security;
alter table public.case_treatments enable row level security;
alter table public.case_statute_links enable row level security;
alter table public.risk_register enable row level security;
alter table public.case_score_overrides enable row level security;

create policy if not exists "case_scores_by_org" on public.case_scores
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy if not exists "case_treatments_by_org" on public.case_treatments
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy if not exists "case_statute_links_by_org" on public.case_statute_links
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy if not exists "risk_register_read" on public.risk_register
  for select
  using (
    (org_id is null) or public.is_org_member(org_id)
  );

create policy if not exists "risk_register_write" on public.risk_register
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy if not exists "case_score_overrides_by_org" on public.case_score_overrides
  for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
