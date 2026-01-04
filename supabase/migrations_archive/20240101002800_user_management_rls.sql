alter table public.org_policies enable row level security;
alter table public.jurisdiction_entitlements enable row level security;
alter table public.audit_events enable row level security;
alter table public.consent_events enable row level security;
alter table public.invitations enable row level security;
alter table public.billing_accounts enable row level security;

drop policy if exists org_policies_select on public.org_policies;
create policy org_policies_select on public.org_policies
  for select using (public.is_org_member(org_id));
drop policy if exists org_policies_modify on public.org_policies;
create policy org_policies_modify on public.org_policies
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists jurisdiction_entitlements_select on public.jurisdiction_entitlements;
create policy jurisdiction_entitlements_select on public.jurisdiction_entitlements
  for select using (public.is_org_member(org_id));
drop policy if exists jurisdiction_entitlements_modify on public.jurisdiction_entitlements;
create policy jurisdiction_entitlements_modify on public.jurisdiction_entitlements
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select on public.audit_events
  for select using (public.is_org_member(org_id));
drop policy if exists audit_events_insert on public.audit_events;
create policy audit_events_insert on public.audit_events
  for insert with check (public.is_org_member(org_id));

drop policy if exists consent_events_select on public.consent_events;
create policy consent_events_select on public.consent_events
  for select using (public.is_org_member(org_id));
drop policy if exists consent_events_insert on public.consent_events;
create policy consent_events_insert on public.consent_events
  for insert with check (public.is_org_member(org_id));

drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations
  for select using (public.is_org_member(org_id));
drop policy if exists invitations_modify on public.invitations;
create policy invitations_modify on public.invitations
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists billing_accounts_select on public.billing_accounts;
create policy billing_accounts_select on public.billing_accounts
  for select using (public.is_org_member(org_id));
drop policy if exists billing_accounts_modify on public.billing_accounts;
create policy billing_accounts_modify on public.billing_accounts
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
