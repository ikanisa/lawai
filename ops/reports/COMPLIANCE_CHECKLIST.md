# Compliance Checklist

| Requirement | Status | Evidence / Notes |
| --- | --- | --- |
| EU AI Act (high-risk) – FRIA checkpoints, HITL, post-market monitoring | ⚠️ | FRIA detection + CEPEJ violations emitted; evaluation gating in CI still pending enforcement. |
| CEPEJ 5 principles mapping | ⚠️ | Metrics views exist (`supabase/migrations/20240101004700_cepej_metrics_view.sql`); need automated alerts + CI thresholds. |
| OHADA pre-emption & CCJA priority | ✅ | Instructions emphasise OHADA priority and CCJA references (`apps/api/src/agent.ts:433-3034`). |
| Canada bilingual equal-force handling | ✅ | Binding language rules + bilingual toggle in UI (`apps/api/src/agent.ts:1015-1060`, `apps/web/src/components/bilingual-toggle.tsx:1-40`). |
| Maghreb banner enforcement | ⚠️ | Banner shown in UI (`apps/web/src/components/research/research-view.tsx:520-610`), but telemetry lacks coverage enforcement + evaluation thresholds not enforced. |
| Rwanda triage & multilingual handling | ✅ | Allowlist and banner in place (`packages/shared/src/constants/allowlist.ts:1-28`, `apps/web/src/components/research/research-view.tsx:133-210`). |
| France analytics ban | ✅ | France guard halts judge analytics and routes HITL (`apps/api/src/agent.ts:4043-4125`). |
| Data residency & retention obligations | ⚠️ | Residency policies defined (`docs/governance/data_residency_matrix.md`, `supabase/migrations/20240101005400_storage_residency_enforcement.sql`) but DR/backup testing undocumented. |
