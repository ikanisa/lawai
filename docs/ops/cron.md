# Scheduler worker for compliance reports

This worker lives in `apps/ops` and orchestrates all automated compliance digests using [`node-cron`](https://github.com/kelektiv/node-cron). It wraps the existing CLI flows (transparency report, SLO snapshot, and regulator digest) so that we can deploy a single long-lived process in infrastructure environments.

## Features

- Runs all scheduled compliance jobs through `runScheduledReports`, writing audit logs and persistence rows as before.
- Respects feature flags so individual jobs can be paused without redeploying the worker.
- Supports dry-run mode for the transparency report and parity toggles for the regulator digest.

## Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Required service credentials for persisting report runs. | — |
| `API_BASE_URL` | Base URL for API requests. | `http://localhost:3000` |
| `DISPATCH_ORG_ID`, `DISPATCH_USER_ID` | Preferred IDs for scheduling. Falls back to transparency IDs when not set. | `00000000-0000-0000-0000-000000000000` |
| `OPS_REPORTS_CRON` | Cron expression for the worker cadence. | `0 6 * * *` |
| `OPS_REPORTS_TZ` | IANA timezone for the cron expression. | `UTC` |
| `OPS_REPORT_TRANSPARENCY_ENABLED` | Enable/disable the transparency job. | `true` |
| `OPS_REPORT_TRANSPARENCY_DRY_RUN` | Force the transparency job to dry-run mode. | `false` |
| `OPS_REPORT_SLO_ENABLED` | Enable/disable SLO snapshot collection. | `true` |
| `OPS_REPORT_REGULATOR_ENABLED` | Enable/disable regulator digests. | `true` |
| `OPS_REPORT_REGULATOR_VERIFY_PARITY` | Toggle dispatch parity checks before queueing digests. | `true` |

Use `pnpm --filter @apps/ops reports-cron -- --once` to trigger a one-off run, or omit `--once` to keep the scheduler running in the foreground.

## macOS deployment with `launchd`

1. Create a plist at `~/Library/LaunchAgents/ai.avocat.ops.reports.plist`:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
     <dict>
       <key>Label</key>
       <string>ai.avocat.ops.reports</string>
       <key>ProgramArguments</key>
       <array>
         <string>/usr/local/bin/pnpm</string>
         <string>--filter</string>
         <string>@apps/ops</string>
         <string>reports-cron</string>
       </array>
       <key>EnvironmentVariables</key>
       <dict>
         <key>SUPABASE_URL</key>
         <string>https://...</string>
         <key>SUPABASE_SERVICE_ROLE_KEY</key>
         <string>supabase-service-key</string>
         <key>API_BASE_URL</key>
         <string>https://api.avocat.ai</string>
         <!-- Add feature flag overrides here as needed -->
       </dict>
       <key>StandardOutPath</key>
       <string>/usr/local/var/log/ops-reports.log</string>
       <key>StandardErrorPath</key>
       <string>/usr/local/var/log/ops-reports-error.log</string>
       <key>RunAtLoad</key>
       <true/>
       <key>KeepAlive</key>
       <true/>
     </dict>
   </plist>
   ```

2. Load and start the agent:

   ```bash
   launchctl load ~/Library/LaunchAgents/ai.avocat.ops.reports.plist
   launchctl start ai.avocat.ops.reports
   ```

3. Inspect logs via `log stream --style syslog --predicate 'process == "pnpm" && eventMessage CONTAINS "reports-cron"'` when debugging.

## Linux deployment with `systemd`

1. Create `/etc/systemd/system/ops-reports.service`:

   ```ini
   [Unit]
   Description=Avocat OPS Scheduled Reports
   After=network.target

   [Service]
   Type=simple
   WorkingDirectory=/opt/avocat
   Environment="SUPABASE_URL=https://..."
   Environment="SUPABASE_SERVICE_ROLE_KEY=supabase-service-key"
   Environment="API_BASE_URL=https://api.avocat.ai"
   ExecStart=/usr/bin/pnpm --filter @apps/ops reports-cron
   Restart=on-failure
   RestartSec=10
   StandardOutput=append:/var/log/ops-reports.log
   StandardError=append:/var/log/ops-reports-error.log

   [Install]
   WantedBy=multi-user.target
   ```

2. (Optional) Install a timer for explicit cadence overrides at the process level by adding `/etc/systemd/system/ops-reports.timer`:

   ```ini
   [Unit]
   Description=Trigger OPS reports cron worker

   [Timer]
   OnBootSec=2min
   OnUnitActiveSec=30min
   Unit=ops-reports.service

   [Install]
   WantedBy=timers.target
   ```

   When a timer is used, update the service to run `pnpm --filter @apps/ops reports-cron -- --once` so each activation executes a single cycle.

3. Reload `systemd` and enable the worker:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now ops-reports.service
   # Or enable the timer if using the timer variant:
   sudo systemctl enable --now ops-reports.timer
   ```

4. Monitor the logs with `journalctl -u ops-reports.service -f`.

With either deployment method, adjust environment variables to toggle feature flags or dry-run modes. Changing the values and restarting the unit is enough to reconfigure the worker.
