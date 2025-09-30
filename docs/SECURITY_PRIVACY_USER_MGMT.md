# Security & Privacy Controls for User Management

## Minimal data retention

- Store only `email` and `phone_e164` in `profiles` for contact/verification.
- WhatsApp identities keep hashed `wa_id` + phone; OTP records persist hashed values until expiry.
- Admin-managed policies and entitlements are per-org, scoped via RLS.

## Authentication & MFA

- WhatsApp OTP provides possession factor. Admin/Owner/Reviewer roles are flagged `mfaRequired` via policy and enforced by `ensureOrgAccessCompliance`.
- Session bootstrap issues a short-lived JWT; client can exchange for Supabase session tokens or use it for API calls.
- Passkeys and device management surface in the security panel (prompted after OTP success).

## Rate limiting & abuse prevention

- Per-IP (10/min) and per-phone (3/min) throttle on `/auth/wa/start`.
- After three starts within 5 minutes a CAPTCHA token is required (hook available on the request body).
- OTP attempts recorded with `attempts` counter; after 5 failed tries the code is revoked and audit trail persists.

## Logging & monitoring

- Audit events capture: OTP sent/verify success, WhatsApp link/unlink, invitations, policy changes, jurisdiction edits.
- Link-health CLI runs nightly and alerting surfaces in Admin › Alerts.
- Rate-limit denials return 429 for observability; include `retry_after` timestamp.

## Data residency & storage

- `residency_zone` controls storage buckets/vector store routing (enforced downstream by ingestion workers and `ops:check`).
- Confidential mode disables hybrid search and local cache to respect file-only residency.

## Privacy-by-design

- No plaintext OTP or message content is stored. `wa_otp` table is service-role only.
- Invite tokens are UUIDs with expiry; once accepted the token is marked `accepted_by`.
- Consent events include `org_id` so each org can prove policy acknowledgement.

## Incident response

- Runbooks:
  - `docs/runbooks/wa_key_rotation.md` — rotate WhatsApp token and phone secrets.
  - `docs/runbooks/otp_abuse.md` — manage OTP flooding / SIM swap suspicion.
  - `docs/runbooks/gdpr_wa_phone_deletion.md` — remove WhatsApp identities + profile PII under GDPR.

## Recommendations

- Configure webhook signing (provider-specific) for inbound WA messages before enabling interactive flows.
- Enable Redis-based rate limiting by setting `RATE_LIMIT_REDIS_URL` when running at scale.
- Keep OTP templates in French (default locale) and replicate in English if multi-lingual support is required.

