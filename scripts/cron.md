# Scheduling jobs without Vercel Cron

With the removal of the Vercel Cron integration the repository no longer ships
an automated schedule. Operators are expected to wire up their own scheduling on
platforms such as `cron(8)` on macOS/Linux or a lightweight Node.js runner (for
example [`node-cron`](https://www.npmjs.com/package/node-cron)).

## Recommended cadence

The table below mirrors the cadence that previously lived in the Vercel Cron
configuration. It covers the Supabase Edge Functions that keep the ingestion and
reporting pipelines healthy.

| Function | Suggested schedule | Notes |
| -------- | ------------------ | ----- |
| `crawl-authorities` | `0 */6 * * *` | Re-fetch authority sources every six hours. |
| `process-learning` | `0 * * * *` | Hourly fast-path ingest/learning refresh. |
| `process-learning --mode nightly` | `30 2 * * *` | Deeper nightly reconciliation window. |
| `drive-watcher` | `*/15 * * * *` | Poll Google Drive deltas for new evidence. |
| `regulator-digest` | `0 6 * * *` | Build the daily compliance digest (uses `days=7`). |
| `transparency-digest` | `30 6 * * 1` | Weekly transparency roll-up (uses `days=30`). |

Adapt the cadence to match the throughput and quotas of your Supabase project.
The `days` arguments shown above map to the payload previously shipped with the
Vercel Cron schedule.

## Using system cron (macOS/Linux)

1. Create a shell wrapper that exports the required environment before calling
the Supabase Edge Function. Save the snippet below as `scripts/run-function.sh`:

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail

   SUPABASE_URL=${SUPABASE_URL:-""}
   SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-""}

   if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
     echo "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" >&2
     exit 1
   fi

   FUNCTION="$1"; shift
   curl -sSf -X POST "${SUPABASE_URL%/}/functions/v1/${FUNCTION}" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H 'Content-Type: application/json' \
     -d "${1:-{}}"
   ```

2. Register the cron job with `crontab -e`:

   ```cron
   */15 * * * * cd /path/to/lawai && ./scripts/run-function.sh drive-watcher '{}'
   30 6 * * 1 cd /path/to/lawai && ./scripts/run-function.sh transparency-digest '{"args":{"days":30}}'
   ```

   Remember to mark the wrapper executable (`chmod +x scripts/run-function.sh`) and
   to load your secrets through a `.env` file or a credential manager such as
   `direnv`, `1Password`, or macOS Keychain.

## Using `node-cron`

For local development you may prefer a purely Node.js workflow. The snippet
below shows how to run the same schedules from a script inside this repository.
Store the file as `scripts/local-cron-runner.mjs` and run it with `pnpm node`.

```js
import 'dotenv/config';
import cron from 'node-cron';
import fetch from 'node-fetch';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const callFunction = async (name, body = {}) => {
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed ${name}: ${res.status} ${text}`);
  }
};

cron.schedule('0 */6 * * *', () => callFunction('crawl-authorities'));
cron.schedule('0 * * * *', () => callFunction('process-learning', { args: { mode: 'hourly' } }));
cron.schedule('30 2 * * *', () => callFunction('process-learning', { args: { mode: 'nightly' } }));
cron.schedule('*/15 * * * *', () => callFunction('drive-watcher'));
cron.schedule('0 6 * * *', () => callFunction('regulator-digest', { args: { days: 7 } }));
cron.schedule('30 6 * * 1', () => callFunction('transparency-digest', { args: { days: 30 } }));

console.log('Local cron runner started…');
```

Running `pnpm node scripts/local-cron-runner.mjs` keeps the process alive with
in-memory schedules—ideal for demos or when a MacBook is acting as the operator
console.

## Operational checklist

- Store long-lived secrets using a secure manager; avoid committing them to
  Git.
- Monitor job output with a log shipper (e.g. `cron` email output, `pm2`, or the
  terminal session running `node-cron`).
- Review schedules quarterly to ensure they still align with production load.
