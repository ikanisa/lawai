# Local Cron Replacement Strategy

With Vercel scheduled functions removed from the workflow, recurring jobs (ingestion refreshes, evaluation runs, Drive watcher pings) must be orchestrated locally or within your own infrastructure. This document outlines two supported approaches.

## Option 1: Node-based schedulers (`node-cron`)

1. Install the dependency in the workspace or a dedicated automation package:
   ```bash
   pnpm add -D node-cron
   ```
2. Create a scheduler script (e.g., `scripts/run-schedules.mjs`):
   ```js
   import cron from 'node-cron';
   import { triggerDriveWatcher } from '../apps/ops/src/jobs/drive-watcher';
   import { runNightlyEvaluations } from '../apps/ops/src/jobs/evaluations';

   cron.schedule('0 * * * *', async () => {
     await triggerDriveWatcher();
   });

   cron.schedule('30 2 * * *', async () => {
     await runNightlyEvaluations();
   });
   ```
3. Launch the scheduler alongside your services:
   ```bash
   pnpm node --scripts-path scripts run-schedules.mjs
   ```
4. Use `.env.local` and the app-specific `.env.local` files so the scheduler has the same Supabase/OpenAI credentials as the rest of the stack.

This option keeps everything in JavaScript/TypeScript and is easy to extend with additional jobs.

## Option 2: macOS `launchd`

For MacBook operators who prefer system-level scheduling:

1. Create a plist at `~/Library/LaunchAgents/com.avocat-ai.cron.plist`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
     <dict>
       <key>Label</key>
       <string>com.avocat-ai.cron</string>
       <key>ProgramArguments</key>
       <array>
         <string>/usr/local/bin/pnpm</string>
         <string>ops:cron</string>
       </array>
       <key>StartCalendarInterval</key>
       <array>
         <dict>
           <key>Hour</key>
           <integer>2</integer>
           <key>Minute</key>
           <integer>30</integer>
         </dict>
       </array>
       <key>StandardOutPath</key>
       <string>/tmp/avocat-ai-cron.log</string>
       <key>StandardErrorPath</key>
       <string>/tmp/avocat-ai-cron.err</string>
       <key>EnvironmentVariables</key>
       <dict>
         <key>NODE_ENV</key>
         <string>production</string>
       </dict>
     </dict>
   </plist>
   ```
2. Load the job:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.avocat-ai.cron.plist
   ```
3. Define the referenced `ops:cron` script in `package.json` (e.g., `"ops:cron": "pnpm --filter @apps/ops trigger:nightly"`).

This integrates with macOS boot-up, restarts failed jobs automatically, and keeps logs under `/tmp/` by default.

## Operational tips

- Use the same `.env.local` secrets for cron scripts to avoid drift between manual and scheduled runs.
- Add health checks (`pnpm ops:check`) as separate cron entries to verify Supabase buckets and vector stores remain in sync.
- When running on CI or Linux servers, the same job definitions can be ported to systemd timers or GitHub Actions, since no Vercel APIs are required anymore.
