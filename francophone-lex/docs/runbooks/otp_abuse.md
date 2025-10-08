# Runbook – OTP Abuse / SIM Swap Suspected

1. **Detect**
   - Monitor audit events for spikes in `wa_otp_sent` to the same number.
   - Observe rate-limit metrics (429 responses, captcha_required) and alerts.
   - Review support tickets for users reporting unsolicited codes.

2. **Contain**
   - Temporarily block the phone by forcing `wa_otp` deletion and inserting a deny entry (custom allowlist or policy).
   - Increase CAPTCHA requirement by setting `WA_CAPTCHA_REQUIRED_FOR` policy if configured.
   - Notify security contact; confirm the user via out-of-band channel.

3. **Eradicate**
   - Rotate `WA_TOKEN` if provider credentials might be compromised.
   - Inspect audit trail for unauthorized `wa_linked` events; unlink suspicious accounts (`POST /auth/wa/unlink`).

4. **Recovery**
   - Re-enable OTP delivery once verified user confirms ownership.
   - Encourage enabling passkeys/MFA for high-privilege roles.
   - Document incident in `audit_events` and close with lessons learned.

