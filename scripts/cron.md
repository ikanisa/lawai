# Cron replacement notes

Managed cron tasks previously ran via the hosted provider. With the migration to self-hosted Node.js services we need a lightweight scheduler strategy.

## Current state

- Edge functions continue to deploy through Supabase and can be triggered via the Supabase scheduler or manual CLI invocations.
- No Node-based cron worker exists yet; CLI commands such as `pnpm --filter @apps/ops regulator-digest` remain manual.
- Preview workflows no longer provision hosted schedules automatically.

## TODO

1. Evaluate `node-cron` or `bullmq` for local/VM scheduling of ops tasks.
2. Document how to run scheduled jobs with macOS `launchd` for single-machine hosting.
3. Provide sample systemd units for Linux servers.
4. Mirror the schedule definitions currently tracked in `supabase/functions/*/function_schedules.json`.

## Interim approach

Until a dedicated scheduler exists:

- Use shell scripts or Make targets that invoke the required `pnpm --filter @apps/ops <command>` jobs.
- If the machine must stay online, add reminders in your calendar tool to run them manually.
- When running inside Supabase, rely on Supabase Edge cron to invoke the deployed functions.

Track progress in the deployment readiness epic within `docs/audit/2025-02-22_taskboard.md`.
