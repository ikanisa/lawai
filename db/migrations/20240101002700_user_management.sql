-- Extend roles and add enterprise user-management tables
ALTER TABLE public.org_members
DROP CONSTRAINT if EXISTS org_members_role_check;

ALTER TABLE public.org_members
ADD CONSTRAINT org_members_role_check CHECK (
  role IN (
    'owner',
    'admin',
    'member',
    'reviewer',
    'viewer',
    'compliance_officer',
    'auditor'
  )
);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS professional_type text,
ADD COLUMN IF NOT EXISTS bar_number text,
ADD COLUMN IF NOT EXISTS court_id text,
ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.org_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, key)
);

CREATE TABLE IF NOT EXISTS public.jurisdiction_entitlements (
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  juris_code text NOT NULL,
  can_read boolean NOT NULL DEFAULT FALSE,
  can_write boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, juris_code)
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  actor_user_id uuid,
  kind text NOT NULL,
  object text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  consent_type text NOT NULL,
  version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invitations (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (
    role IN (
      'owner',
      'admin',
      'member',
      'reviewer',
      'viewer',
      'compliance_officer',
      'auditor'
    )
  ),
  expires_at timestamptz NOT NULL,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_accounts (
  org_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  plan text NOT NULL,
  seats int NOT NULL DEFAULT 0,
  metering jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
