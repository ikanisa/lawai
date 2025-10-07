# Next 5 Actions

1. **Wire Drive ingestion alerts** – forward `drive-watcher` failures to Slack/e-mail and surface manifest status in the governance dashboard.
2. **Ship OCR/Akoma Ntoso enrichment** – extend the summarisation pipeline with OCR for PDFs and persist Akoma Ntoso anchors for gazettes with scanned layouts.
3. **Broaden evaluation corpus** – seed additional jurisdictional prompts and integrate recall/precision gating into CI now that link-health thresholds are enforced.
4. **Automate provenance alerts** – push link-health failures from `org_provenance_metrics` to operator notifications and governance dashboards.
5. **Implement citations diff viewer** – build side-by-side diff component fed by `/api/corpus` snapshots and integrate into the Citations screen.
