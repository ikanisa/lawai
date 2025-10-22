# Local hosting guide

This document explains how to serve the Avocat-AI Francophone operator console on
a workstation without relying on Vercel. The steps below assume macOS 14 on a
MacBook, but the commands work on Linux as well.

## Environment file

Create a `.env.local` file at the repository root. Start with the values from
[`.env.example`](../.env.example) and layer on developer specific overrides:

```bash
cp .env.example .env.local
open .env.local # fill in SUPABASE_*, OPENAI_*, NEXT_PUBLIC_* keys
```

The web application reads `.env.local` automatically. The API relies on the same
file when you run `pnpm dev:api`, so you only need to maintain one copy during
local work.

## Install, build, and start

1. Install dependencies once per machine:

   ```bash
   pnpm install
   ```

2. Build the workspaces to ensure shared packages and Next.js output are
   up-to-date:

   ```bash
   pnpm build
   ```

3. Start the web console in production mode. This command honours `.env.local`:

   ```bash
   pnpm start
   ```

   The Next.js server listens on `http://localhost:3000` by default. Use
   `PORT=3001 pnpm start` if the default port is already bound.

For an end-to-end smoke test you can chain the commands together:

```bash
pnpm install && pnpm build && pnpm start
```

## Optional reverse proxy

When exposing the console to colleagues or mobile devices you can front the
Next.js server with a reverse proxy. Two common approaches are:

- **`ngrok`** – run `ngrok http 3000` to obtain a temporary, TLS-terminated URL.
- **`Caddy` or `Nginx`** – terminate TLS locally and forward requests to
  `http://127.0.0.1:3000`. Remember to forward `Host` headers to keep Next.js
  aware of the public origin.

Always protect the proxy with authentication and IP allowlists. The `.env.local`
settings control which Supabase instance and OpenAI project the console talks
to, so treat the proxy as a production entry point.
