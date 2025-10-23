-- Extend organizations metadata
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS compliance_profile jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS residency_zone text DEFAULT 'eu';

-- Extend profiles with contact and professional metadata
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone_e164 text,
ADD COLUMN IF NOT EXISTS professional_type text,
ADD COLUMN IF NOT EXISTS bar_number text,
ADD COLUMN IF NOT EXISTS verified boolean DEFAULT FALSE;

CREATE INDEX if NOT EXISTS idx_profiles_email ON public.profiles (lower(email));

CREATE INDEX if NOT EXISTS idx_profiles_phone ON public.profiles (phone_e164);

-- Update org member roles to support RBAC matrix
ALTER TABLE public.org_members
DROP CONSTRAINT if EXISTS org_members_role_check;

ALTER TABLE public.org_members
ADD CONSTRAINT org_members_role_check CHECK (
  role IN (
    'owner',
    'admin',
    'reviewer',
    'member',
    'viewer',
    'compliance_officer',
    'auditor'
  )
);

-- Org policies table
CREATE TABLE IF NOT EXISTS public.org_policies (
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, key)
);

ALTER TABLE public.org_policies enable ROW level security;

DROP POLICY if EXISTS "org_policies_r" ON public.org_policies;

DROP POLICY if EXISTS "org_policies_rw" ON public.org_policies;

CREATE POLICY "org_policies_access" ON public.org_policies FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

-- Jurisdiction entitlements
CREATE TABLE IF NOT EXISTS public.jurisdiction_entitlements (
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  juris_code text NOT NULL,
  can_read boolean NOT NULL DEFAULT TRUE,
  can_write boolean NOT NULL DEFAULT FALSE,
  PRIMARY KEY (org_id, juris_code)
);

ALTER TABLE public.jurisdiction_entitlements enable ROW level security;

DROP POLICY if EXISTS "juris_entitlements_rw" ON public.jurisdiction_entitlements;

CREATE POLICY "juris_entitlements_access" ON public.jurisdiction_entitlements FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

-- Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  email text,
  role text NOT NULL CHECK (
    role IN (
      'owner',
      'admin',
      'reviewer',
      'member',
      'viewer',
      'compliance_officer',
      'auditor'
    )
  ),
  expires_at timestamptz NOT NULL,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations enable ROW level security;

DROP POLICY if EXISTS "invitations_access" ON public.invitations;

CREATE POLICY "invitations_access" ON public.invitations FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

CREATE INDEX if NOT EXISTS idx_invitations_email ON public.invitations (lower(email));

-- Consent events table
CREATE TABLE IF NOT EXISTS public.consent_events (
  user_id uuid NOT NULL,
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  type text NOT NULL,
  version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_events enable ROW level security;

DROP POLICY if EXISTS "consent_events_access" ON public.consent_events;

CREATE POLICY "consent_events_access" ON public.consent_events FOR ALL USING (
  auth.uid () = user_id
  OR (
    org_id IS NOT NULL
    AND public.is_org_member (org_id)
  )
)
WITH
  CHECK (
    auth.uid () = user_id
    OR (
      org_id IS NOT NULL
      AND public.is_org_member (org_id)
    )
  );

CREATE INDEX if NOT EXISTS idx_consent_user ON public.consent_events (user_id);

CREATE INDEX if NOT EXISTS idx_consent_org ON public.consent_events (org_id);

-- Audit events table (append-only)
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  actor_user_id uuid,
  kind text NOT NULL,
  object text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb,
  ts timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_events enable ROW level security;

DROP POLICY if EXISTS "audit_events_access" ON public.audit_events;

CREATE POLICY "audit_events_access" ON public.audit_events FOR
SELECT
  USING (public.is_org_member (org_id));

-- WhatsApp identities
CREATE TABLE IF NOT EXISTS public.wa_identities (
  wa_id text PRIMARY KEY,
  phone_e164 text NOT NULL,
  user_id uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS idx_wa_phone ON public.wa_identities (phone_e164);

CREATE INDEX if NOT EXISTS idx_wa_user ON public.wa_identities (user_id);

ALTER TABLE public.wa_identities enable ROW level security;

DROP POLICY if EXISTS "wa_identities_access" ON public.wa_identities;

CREATE POLICY "wa_identities_access" ON public.wa_identities FOR ALL USING (
  user_id IS NULL
  OR auth.uid () = user_id
  OR EXISTS (
    SELECT
      1
    FROM
      public.org_members om
    WHERE
      om.user_id = wa_identities.user_id
      AND public.is_org_member (om.org_id)
  )
)
WITH
  CHECK (
    user_id IS NULL
    OR auth.uid () = user_id
  );

-- WhatsApp OTP storage (service role access only)
CREATE TABLE IF NOT EXISTS public.wa_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS idx_wa_otp_phone ON public.wa_otp (phone_e164);

CREATE INDEX if NOT EXISTS idx_wa_otp_expiry ON public.wa_otp (expires_at);

ALTER TABLE public.wa_otp enable ROW level security;

DROP POLICY if EXISTS "wa_otp_service_read" ON public.wa_otp;

DROP POLICY if EXISTS "wa_otp_service_write" ON public.wa_otp;

CREATE POLICY "wa_otp_service" ON public.wa_otp FOR ALL USING (auth.role () = 'service_role')
WITH
  CHECK (auth.role () = 'service_role');
