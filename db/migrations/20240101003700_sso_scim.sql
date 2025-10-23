-- Enterprise SSO and SCIM tables plus profile enhancements
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.sso_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('saml', 'oidc')),
  label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  acs_url text,
  entity_id text,
  client_id text,
  client_secret text,
  default_role text NOT NULL DEFAULT 'member' CHECK (
    default_role IN (
      'owner',
      'admin',
      'member',
      'reviewer',
      'viewer',
      'compliance_officer',
      'auditor'
    )
  ),
  group_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

CREATE INDEX if NOT EXISTS sso_connections_org_idx ON public.sso_connections (org_id);

CREATE TABLE IF NOT EXISTS public.scim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_used_at timestamptz
);

CREATE UNIQUE INDEX if NOT EXISTS scim_tokens_hash_idx ON public.scim_tokens (token_hash);

CREATE TABLE IF NOT EXISTS public.ip_allowlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  cidr text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX if NOT EXISTS ip_allowlist_org_idx ON public.ip_allowlist_entries (org_id);
