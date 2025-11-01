# Ops playbooks

These playbooks provide task-level guidance for the Ops CLI. Use them alongside [`../RUNBOOKS.md`](../RUNBOOKS.md) when responding to incidents.

## Provisioning a new environment

1. **Validate secrets:** `pnpm env:validate` ensures `.env.local` is current.
2. **Apply migrations:** `pnpm db:migrate` followed by `pnpm --filter @apps/ops run migrate -- --env <target>`.
3. **Bootstrap fixtures:** `pnpm --filter @apps/ops run foundation` provisions buckets, allowlists, vector stores.
4. **Smoke test:** Run `pnpm --filter @apps/ops run check` and confirm the **Automation › Provisioning health** dashboard is green.

## Rolling back a failed deployment

1. **Freeze traffic:** Trigger maintenance mode in Vercel.
2. **Restore database snapshot:** Use Supabase PITR if migrations failed; reference `db/migrations/` for manual rollback scripts.
3. **Redeploy last known good artifact:** `vercel deploy --prod --prebuilt` from the previous commit SHA.
4. **Verification:** Execute `pnpm --filter @apps/ops run go-no-go` and review **API Core SLOs** dashboard.

## Handling OpenAI throttling

1. Check **OpenAI Request Health** dashboard for spike patterns.
2. Run `pnpm --filter @apps/ops run evaluate -- --suite smoke --throttle-window 5m` to reproduce under backoff.
3. Toggle retry settings via `OPENAI_REQUEST_TAGS_OPS` to mark degraded mode.
4. Coordinate with API owners to reduce concurrency temporarily.

## Secrets rotation workflow

1. Execute `pnpm --filter @apps/ops run rotate-secrets`.
2. Update Supabase project secrets and Vercel environment variables.
3. Commit updated `.env.example` entries if new keys were introduced.
4. Run `pnpm ops:check` and confirm Grafana **Automation › Secrets freshness** returns to green.

## Incident communication

- Use the template in `docs/runbooks/openai-foundation.md` when posting status updates.
- Attach the latest `pnpm --filter @apps/ops run slo` report when notifying compliance stakeholders.
