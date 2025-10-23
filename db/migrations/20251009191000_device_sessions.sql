CREATE TABLE IF NOT EXISTS public.device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  session_token text NOT NULL,
  device_fingerprint text NOT NULL,
  device_label text,
  user_agent text,
  platform text,
  client_version text,
  ip_address inet,
  auth_strength text,
  mfa_method text,
  attested boolean,
  passkey boolean,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_reason text
);

ALTER TABLE public.device_sessions
ADD CONSTRAINT device_sessions_org_session_token_unique UNIQUE (org_id, session_token);

CREATE INDEX if NOT EXISTS device_sessions_org_last_seen_idx ON public.device_sessions (org_id, last_seen_at DESC);

CREATE INDEX if NOT EXISTS device_sessions_user_last_seen_idx ON public.device_sessions (user_id, last_seen_at DESC);

CREATE INDEX if NOT EXISTS device_sessions_fingerprint_idx ON public.device_sessions (device_fingerprint);

ALTER TABLE public.device_sessions enable ROW level security;

DROP POLICY if EXISTS device_sessions_service_role_access ON public.device_sessions;

CREATE POLICY device_sessions_service_role_access ON public.device_sessions FOR ALL USING (auth.role () = 'service_role')
WITH
  CHECK (auth.role () = 'service_role');

DROP POLICY if EXISTS device_sessions_org_read ON public.device_sessions;

CREATE POLICY device_sessions_org_read ON public.device_sessions FOR
SELECT
  USING (public.is_org_member (org_id));

DROP POLICY if EXISTS device_sessions_org_write ON public.device_sessions;

CREATE POLICY device_sessions_org_write ON public.device_sessions
FOR UPDATE
  USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
