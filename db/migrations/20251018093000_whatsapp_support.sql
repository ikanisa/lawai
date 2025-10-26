-- Restore WhatsApp/phone contact support objects missing from production.
-- Idempotent DDL guarded with IF NOT EXISTS to avoid conflicts on re-run.
BEGIN;

-- Ensure profiles table exposes phone numbers for OTP / WhatsApp flows.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_e164 text;

-- Add indexes used by account provisioning and lookup flows.
CREATE INDEX if NOT EXISTS idx_profiles_email ON public.profiles (lower(email));

CREATE INDEX if NOT EXISTS idx_profiles_phone ON public.profiles (phone_e164);

-- WhatsApp identity mapping between WhatsApp sender IDs and users.
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

-- WhatsApp OTP scratch space (service-role only).
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

DROP POLICY if EXISTS "wa_otp_service" ON public.wa_otp;

CREATE POLICY "wa_otp_service" ON public.wa_otp FOR ALL USING (auth.role () = 'service_role')
WITH
  CHECK (auth.role () = 'service_role');

COMMIT;
