# Incident Response Plan

1. **Detection & Triage** – automated monitors (HITL latency SLAs, ingestion health, vector store sync) raise alerts in less than 5 minutes.
2. **Engagement** – the on-call reviewer and platform engineer are paged; the customer success lead is informed.
3. **Containment** – disable impacted connectors or switch to cached sources; enforce confidential mode if data leak is suspected.
4. **Resolution** – apply fixes, rerun affected pipelines, and record remediation in `incident_reports`.
5. **Communication** – notify affected clients and regulators according to severity (`status != 'closed'` for > 2 hours triggers regulator outreach).
6. **Post-mortem** – publish summary and follow-up actions in the change log within 48 hours.

Refer to the Supabase table `incident_reports` for operational history and evidence links.
