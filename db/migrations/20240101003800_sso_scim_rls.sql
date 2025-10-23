ALTER TABLE public.sso_connections enable ROW level security;

ALTER TABLE public.scim_tokens enable ROW level security;

ALTER TABLE public.ip_allowlist_entries enable ROW level security;

DROP POLICY if EXISTS sso_connections_manage ON public.sso_connections;

CREATE POLICY sso_connections_manage ON public.sso_connections FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS scim_tokens_manage ON public.scim_tokens;

CREATE POLICY scim_tokens_manage ON public.scim_tokens FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

DROP POLICY if EXISTS ip_allowlist_manage ON public.ip_allowlist_entries;

CREATE POLICY ip_allowlist_manage ON public.ip_allowlist_entries FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
