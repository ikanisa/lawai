ALTER TABLE public.org_policies enable ROW level security;

ALTER TABLE public.jurisdiction_entitlements enable ROW level security;

ALTER TABLE public.audit_events enable ROW level security;

ALTER TABLE public.consent_events enable ROW level security;

ALTER TABLE public.invitations enable ROW level security;

ALTER TABLE public.billing_accounts enable ROW level security;

DROP POLICY if EXISTS org_policies_select ON public.org_policies;

CREATE POLICY org_policies_select ON public.org_policies FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS org_policies_modify ON public.org_policies;

CREATE POLICY org_policies_modify ON public.org_policies FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS jurisdiction_entitlements_select ON public.jurisdiction_entitlements;

CREATE POLICY jurisdiction_entitlements_select ON public.jurisdiction_entitlements FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS jurisdiction_entitlements_modify ON public.jurisdiction_entitlements;

CREATE POLICY jurisdiction_entitlements_modify ON public.jurisdiction_entitlements FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS audit_events_select ON public.audit_events;

CREATE POLICY audit_events_select ON public.audit_events FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS audit_events_insert ON public.audit_events;

CREATE POLICY audit_events_insert ON public.audit_events FOR insert
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS consent_events_select ON public.consent_events;

CREATE POLICY consent_events_select ON public.consent_events FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS consent_events_insert ON public.consent_events;

CREATE POLICY consent_events_insert ON public.consent_events FOR insert
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS invitations_select ON public.invitations;

CREATE POLICY invitations_select ON public.invitations FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS invitations_modify ON public.invitations;

CREATE POLICY invitations_modify ON public.invitations FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS billing_accounts_select ON public.billing_accounts;

CREATE POLICY billing_accounts_select ON public.billing_accounts FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS billing_accounts_modify ON public.billing_accounts;

CREATE POLICY billing_accounts_modify ON public.billing_accounts FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
