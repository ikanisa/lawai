# Runbook – GDPR / WhatsApp Phone Deletion

1. **Verify request**
   - Confirm requester identity and scope (user or admin).
   - Log the request ID in `audit_events` (`kind = 'pii.deletion.request'`).

2. **Data removal**
   - Delete WhatsApp identity: `delete from wa_identities where user_id = :user_id`.
   - Delete OTP records: `delete from wa_otp where phone_e164 = :phone`.
   - Update profile: set `phone_e164 = null`, optionally `verified = false`.
   - Remove invitations referencing the email/phone if required.

3. **Propagation**
   - Revoke active sessions (Supabase auth admin API `signOut`).
   - Notify downstream processors (vector stores, logging analytics) if phone appears in exports.

4. **Audit**
   - Insert `audit_events` (`kind = 'pii.deletion.completed'`) with `after_state` referencing anonymised fields.
   - Respond to requester with confirmation and timestamp.

