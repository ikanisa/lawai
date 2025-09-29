# Change Management Playbook

- **Classification** – every change is tagged as standard, maintenance, or emergency, with impact assessment in `change_log_entries`.
- **CAB Review** – weekly review validates risk, regression tests, and rollback steps.
- **Pre-launch checklist** – ensure updated migrations, vector store sync, and red-team scenarios are green.
- **Communication** – customer updates and regulator notifications are sent for policies `category in ('policy','compliance','incident')`.
- **Post-launch monitoring** – capture an SLO snapshot (`pnpm ops:perf-snapshot`) and update the change log with links to evidence.
