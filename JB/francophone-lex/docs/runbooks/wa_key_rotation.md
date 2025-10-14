# Runbook – WhatsApp Credential Rotation

1. Request a new token from the provider (Meta or Twilio). For Twilio, regenerate the auth token and record the SID.
2. Update secrets:
   - `WA_TOKEN`
   - `WA_PHONE_NUMBER_ID` (if number changed)
   - `WA_WEBHOOK_VERIFY_TOKEN` (optional but recommended)
3. Redeploy API with new environment variables; confirm `/healthz` is green.
4. Trigger `pnpm ops:check -- --ci` to verify service-role connectivity.
5. Send a smoke OTP to a test number (`curl POST /auth/wa/start`). Ensure audit event `wa_otp_sent` is logged.
6. Revoke old token on provider side to prevent reuse.

Rollback: restore previous token (if still valid) and redeploy. Review audit events for OTP failures during the rotation.

