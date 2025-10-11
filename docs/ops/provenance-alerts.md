# Provenance Alerts (Link-Health)

This edge function sends Slack/email alerts when link-health degrades for authoritative sources per organization.

## Function

- Path: `apps/edge/provenance-alerts/index.ts`
- Inputs: `orgId` (optional). If omitted, scans all orgs.
- Output: JSON `{ results: Array<{ orgId, alerted, stale, failed }> }`

## Environment

Set the following variables in your Edge environment:

- `ALERTS_SLACK_WEBHOOK_URL` (optional): Slack webhook to receive alerts
- `ALERTS_EMAIL_WEBHOOK_URL` (optional): Internal email relay webhook, accepts JSON `{ subject, body }`
- `PROVENANCE_STALE_RATIO_THRESHOLD` (default `0.15`): Alert if `sources_link_stale / total_sources >= threshold`
- `PROVENANCE_FAILED_COUNT_THRESHOLD` (default `0`): Alert if `sources_link_failed >= threshold`

## Triggering

### Manual

```
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"orgId":"00000000-0000-0000-0000-000000000000"}' \
  https://<your-edge-host>/provenance-alerts
```

### Supabase Cron (example)

Create a daily cron to call the function without params (all orgs):

1. Deploy the Edge function alongside your other functions.
2. In Supabase Dashboard → Database → Cron, add a job:
   - Name: `provenance-alerts-daily`
   - Schedule: `0 7 * * *` (07:00 UTC daily)
   - HTTP Request: `POST https://<your-edge-host>/provenance-alerts`
   - Headers: none (public function) or `Authorization: Bearer <service-key>` if you front it via gateway

### Supabase Edge Functions Scheduler (alternative)

If you prefer scheduling inside Edge runtime, configure a service to ping the URL on schedule (e.g., GitHub Actions, Cloud Scheduler).

## Alert Format

Slack message example:

```
provenance-alerts: link-health for <orgId>
- ok_recent: <n>
- stale: <n> (<ratio%>) (threshold <threshold%>)
- failed: <n> (threshold <count>)
```

Email payload example:

```
{
  "subject": "Provenance alerts: link-health for <orgId>",
  "body": {
    "org_id": "<orgId>",
    "total_sources": 123,
    "sources_link_ok_recent": 118,
    "sources_link_stale": 4,
    "sources_link_failed": 1
  }
}
```

