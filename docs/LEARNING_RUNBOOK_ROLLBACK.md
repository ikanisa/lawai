# Runbook – Learning Policy Rollback

**Objective:** revert to the last stable `agent_policy_versions` entry within five minutes if evaluation metrics fail.

## Preconditions

- Access to Admin console (Reviewer/Admin/Owner) or Ops CLI.
- Latest policy versions visible (`/api/learning/policies`).

## Steps

1. **Identify regression**
   - Monitor Learning dashboard alerts or nightly evaluate-and-gate output.
   - Note failing metrics and affected policy_version_id.

2. **Immediate rollback**
   - Via API: `POST /api/learning/rollback { policy_version_id }` with admin credentials.
   - Or use Ops CLI (P1): `pnpm --filter @apps/ops run-learning-cycle --rollback <version>`.

3. **Verify**
   - Re-run evaluation: `pnpm --filter @apps/ops evaluate -- --ci --limit 10`.
   - Check `learning_metrics` for metrics returning above thresholds.

4. **Communicate & audit**
   - Add incident entry in `agent_policy_versions` notes and `audit_events`.
   - Notify stakeholders (Slack/Email) with timeline and cause.

5. **Remediate**
   - Diagnose problematic change (synonym, hint, canonicalizer, denylist) and adjust or delete before re-applying.

