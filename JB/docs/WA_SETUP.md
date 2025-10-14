# WhatsApp OTP Setup

This guide describes how to connect the WhatsApp Business transport used by Avocat-AI to deliver one-time passwords (OTP).

## 1. Choose a provider

Set the environment variable `WA_PROVIDER` to either:

- `meta` — WhatsApp Business Cloud API (recommended for Meta-managed numbers)
- `twilio` — Twilio Programmable Messaging with WhatsApp enabled

## 2. Required environment variables

| Key | Description |
| --- | --- |
| `WA_TOKEN` | Provider access token. For Twilio, use `ACCOUNT_SID:AUTH_TOKEN`. |
| `WA_PHONE_NUMBER_ID` | Meta: phone number ID. Twilio: WhatsApp-enabled phone in E.164. |
| `WA_WEBHOOK_VERIFY_TOKEN` | Shared secret to validate webhook callbacks. |
| `WA_TEMPLATE_OTP_NAME` | Approved WhatsApp template name (e.g. `otp_login`). |
| `WA_TEMPLATE_LOCALE` | Locale code for the template (e.g. `fr`). |

Ensure the general env block also provides `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET`.

## 3. Meta setup

1. Create a WhatsApp Business app and acquire a permanent access token.
2. Register the sending phone number via Meta Business Manager and note the `phone_number_id`.
3. Approve an OTP template (`{{1}}` parameter for the code).
4. Configure the webhook URL to point to `/wa/webhook` and provide `WA_WEBHOOK_VERIFY_TOKEN`.

## 4. Twilio setup

1. Enable the WhatsApp sandbox or apply for production access.
2. Note the account SID and auth token (`WA_TOKEN = SID:AUTH_TOKEN`).
3. Purchase or enable a WhatsApp phone number and set `WA_PHONE_NUMBER_ID` to `+E164` form.
4. Create a template message containing `{{CODE}}` and submit for approval.

## 5. Rate limits & monitoring

- The API enforces per-phone and per-IP throttles. Monitor audit events `wa_otp_sent` for spikes.
- OTP expiry defaults to 10 minutes; adjust in `apps/api/src/otp.ts` if needed.
- Ensure the webhook endpoint is reachable even if you only log inbound traffic today (future features may rely on it).

## 6. Local testing

If `WA_TOKEN` or `WA_PHONE_NUMBER_ID` is missing the API falls back to a console adapter. OTP codes will be logged via `app.log.info` and no network calls are performed.

