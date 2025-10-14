# Multi-tenant User Management Model

Avocat-AI relies on Supabase Postgres RLS to guarantee tenant isolation while combining role-based (RBAC) and attribute-based (ABAC) permissions.

## Core tables

- `organizations` — tenant metadata (`plan`, `compliance_profile`, `residency_zone`).
- `org_members` — junction between `auth.users` and organizations with roles (`owner`, `admin`, `reviewer`, `member`, `viewer`, `compliance_officer`, `auditor`).
- `profiles` — user profile data (minimal PII: email, phone, locale, professional info, verification flag).
- `org_policies` — feature flags (confidential mode, France-mode, residency zone, etc.).
- `jurisdiction_entitlements` — per-jurisdiction read/write toggles.
- `invitations` — time-bound membership invites with pre-assigned roles.
- `consent_events` — track policy acceptance per user/org.
- `audit_events` — append-only log for privileged actions.
- `wa_identities` / `wa_otp` — WhatsApp phone linkage and OTP storage (hashed, service-role only).

## Row-level security (RLS)

Every org-scoped table uses `public.is_org_member(org_id)` in `USING/WITH CHECK`. `wa_otp` is service-role only (`auth.role() = 'service_role'`). `consent_events` allow the user or members of the same organization to read entries.

## RBAC × ABAC

| Action | Roles |
| --- | --- |
| `research.run`, `drafting.edit` | member, reviewer, admin, owner |
| `hitl.review` | reviewer, admin, owner |
| `corpus.manage` | admin, owner |
| `policies.manage` | admin, owner, compliance_officer |
| `billing.manage` | owner |
| `audit.read` | auditor, compliance_officer, admin, owner |
| `people.manage` | admin, owner |
| `allowlist.toggle` | admin, owner |
| `residency.change` | owner |
| `sso_scim.manage` | admin, owner |
| `data.export_delete` | owner |

Policy flags (ABAC) include:

- `confidential_mode` — disable hybrid/web search, blur previews, enforce File Search, and require HITL for sensitive topics.
- `fr_judge_analytics_block` — hide and deny judge analytics surfaces.
- `sensitive_topic_hitl` — escalate flagged research for human review.
- `residency_zone` — hints storage/vector store residency enforcement.

`access-control.ts` resolves org context (role, policies, entitlements, IP allowlist, consent version) and applies runtime checks (MFA requirement, IP allowlist, consent gating).

## Invitations & onboarding

1. Admin/Owner creates an invite (`invitations`) specifying email, role, expiry.
2. Invitee completes WhatsApp OTP login, profile enrichment, and joins the org via token.
3. Consent events capture policy acceptance; audit events log `invite.created` + `invite.accepted`.

## Auditability

All privileged endpoints insert `audit_events` with `before_state` / `after_state` JSON snapshots. Audit retrieval is available to auditors/compliance users.

## WhatsApp OTP linking

- OTP codes are hashed (scrypt) in `wa_otp` with TTL (10 min) and attempt lockout (>5 attempts).
- Successful verification issues a signed JWT (HS256 via `JWT_SECRET`) to bootstrap the Supabase session exchange.
- Linking/unlinking WhatsApp numbers records audit events `wa_linked` / `wa_unlinked` and updates `profiles.phone_e164`.
