# Finance Worker Harness – Service Integration Cheatsheet

All finance domain executors live in `apps/api/src/finance-workers.ts` and run through the shared `processFinanceQueue` loop. Each executor has the same pattern:
1. Assert connectors (via `org_connectors`) are active and configured.
2. Persist state to Supabase tables (see migration `db/migrations/20251003210000_finance_domain_sources.sql`).
3. Optionally call external services (ERP, tax gateways, BI, GRC, regulatory portals).
4. Emit `FinanceCommandResult` with telemetry, notices, follow-ups.

Below is the proposed mapping of external calls and connectors to flesh out.

## Tax Compliance Agent
- **Connector requirement**: `tax_authority_gateway` (type `tax`); optionally `general_ledger` (type `erp`).
- **Supabase tables**: `finance_tax_filings`.
- **External service interactions**:
  - Submit filing: `POST {gateway}/filings` with payload; capture submission ID -> store in `metadata.submissionId`.
  - Audit response: `POST {gateway}/audit-responses` (+ file upload); update status to `audit`.
  - Deadline lookup: `GET {gateway}/filings/{jurisdiction}/{period}` -> update `due_date`.

## Accounts Payable Agent
- **Connector**: `payables_module` (type `erp`).
- **Table**: `finance_ap_invoices`.
- **External calls**:
  - Invoice ingestion: `POST {erp}/ap/invoices`; persist returned invoice id.
  - Payment scheduling: `POST {erp}/ap/payments/schedule`; update `payment_scheduled_for`.
  - Status confirmation: `GET {erp}/ap/invoices/{id}` when needed.

## Audit & Assurance Agent
- **Connector**: `grc_platform`.
- **Table**: `finance_audit_walkthroughs` (also used for PBC metadata).
- **External calls**:
  - Walkthrough creation: `POST {grc}/audit/walkthroughs`.
  - PBC update: `POST {grc}/audit/pbc`.
  - Reference lookups: `GET {grc}/audit/walkthroughs/{process}`.

## Risk & Controls Agent
- **Connector**: `grc_platform`.
- **Tables**: `risk_register`, `finance_risk_control_tests`.
- **External calls**:
  - Risk register update: `POST {grc}/risks` with severity/jurisdiction.
  - Control test log: `POST {grc}/controls/tests`.
  - Control detail: `GET {grc}/controls/{id}` for thresholds.

## CFO Strategy Agent
- **Connector**: `bi_warehouse` (type `analytics`).
- **Table**: `finance_board_packs`.
- **External calls**:
  - Board pack generation: `POST {bi}/board-packs` (returns KPI set, summary).
  - Scenario run: `POST {bi}/scenarios` -> store assumptions/result.
  - Metric fetch: `GET {bi}/kpi?period=...` for telemetry.

## Regulatory Filings Agent
- **Connector**: `regulatory_portal` (type `tax`).
- **Table**: `finance_regulatory_filings`.
- **External calls**:
  - Filing submission: `POST {portal}/filings`.
  - Attachments: `POST {portal}/documents/upload`.
  - Deadline/status: `GET {portal}/filings/{jurisdiction}/{type}`.

## Implementation Tips
- Wrap each external service in a small helper (e.g., `taxGateway.submit(...)`) to ease mocking.
- Use secrets stored in `org_connectors.config` (e.g., apiKey, tenantId).
- Guard logs: never print credentials or document payloads.
- Extend telemetry for dashboards (e.g., `filingsSubmitted`, `paymentsScheduled`).
- Preserve existing HITL logic when services/errors block progress.
