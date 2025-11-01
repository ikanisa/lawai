# Network Connectivity Troubleshooting

Most of the tooling in this repository assumes outbound internet connectivity to reach
OpenAI, Supabase, and the authoritative legal sources that power ingestion. In
some execution environments (including the automated review sandbox used for
CI-style validation) outbound network access is deliberately restricted. When a
command attempts to call an external API it will usually time out or return an
`ENOTFOUND`/`ECONNREFUSED` error, which surfaces in logs as a generic "network
issue".

## Why it happens

1. **Restricted runners** – Security-hardened runners and sandboxes frequently
   block outbound requests by default. That keeps secrets from leaking but also
   means tools such as `pnpm ops:foundation`, ingestion crawlers, or evaluation
   CLIs cannot talk to Supabase or OpenAI.
2. **Missing credentials** – Even when the network is open, missing
   configuration (for example `SUPABASE_SERVICE_ROLE_KEY` or
   `OPENAI_API_KEY`) causes SDKs to fail in a way that mimics connectivity
   problems because the underlying clients abort before establishing a TLS
   session.
3. **Allowlisted hosts** – Corporate networks often allow only a curated list of
   hosts. If the OpenAI or Supabase domains are not allowlisted the connection
   handshake will fail.

## How to work around it

- **Use the provided stubs** – The ops CLIs have an offline mode. Set
  `USE_SUPABASE_STUB=true` and `USE_OPENAI_STUB=true` in your environment to
  exercise migrations, evaluations, and tests without reaching external
  services.
- **Run with a VPN or from a machine that has outbound access** – For real
  ingestion and evaluation runs you need a network that can reach the domains
  listed in `packages/shared/src/constants/allowlist.ts` as well as the OpenAI
  and Supabase APIs.
- **Double-check secrets** – Confirm that `.env` contains valid keys and that
  they are exported before running any scripts. The helper `pnpm env:validate`
  prints a concise report.
- **Retry once connectivity is restored** – When CI fails with a network error
  re-run the pipeline after verifying that the runner (or GitHub-hosted agent)
  allows outbound traffic.
- **Check observability dashboards** – The Grafana **Network › Egress** panel
  shows whether traffic is being blocked at the perimeter. **OpenAI Request
  Health** highlights throttling unrelated to local configuration.

## When to escalate

If connectivity is confirmed but operations still fail, gather the error logs,
run `pnpm ops:check --verbose`, and attach the output when opening an issue.
That command dumps the current environment variables (with secrets masked) and
reports which hosts were unreachable. Include screenshots of the relevant
Grafana panels to help correlate environment-level blocking with application
symptoms.
