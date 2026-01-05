# ChatGPT App Store Integration Guide

This document explains how to develop, deploy, and submit the lawai ChatGPT app for the OpenAI App Store.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                         ChatGPT                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                 Widget Iframe                           │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │  │
│  │  │   Corpus     │ │  Governance  │ │   Release    │    │  │
│  │  │  Explorer    │ │  Dashboard   │ │  Readiness   │    │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘    │  │
│  └────────────────────────────────────────────────────────┘  │
│                            │                                  │
│                            ▼                                  │
│                    window.openai                              │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                      MCP Server                              │
│                    (apps/mcp)                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Tools:                                                   │ │
│  │ - corpus.search / get_document / get_chunks / resummarize│ │
│  │ - crawler.run_authorities                                │ │
│  │ - governance.metrics / snapshot_perf / snapshot_slo      │ │
│  │ - governance.list_slo / transparency_report              │ │
│  │ - release.go_no_go_check                                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│              Existing Backend (apps/api + Supabase)          │
│  - /metrics/governance, /metrics/slo, /reports/transparency  │
│  - /corpus/:id/resummarize                                   │
│  - Supabase Edge Functions (crawl-authorities)               │
│  - Direct Supabase queries for search/documents              │
└──────────────────────────────────────────────────────────────┘
```

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 8.15+
- Supabase CLI (if testing Edge Functions)

### Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template
cp apps/mcp/.env.example apps/mcp/.env

# Edit .env with your credentials
# Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_BASE_URL

# Start the existing API (needed for governance tools)
pnpm dev:api

# Start the MCP server in another terminal
pnpm dev:mcp
```

The MCP server runs at `http://localhost:8787/mcp`.

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector http://localhost:8787/mcp
```

This opens a browser UI where you can:
1. See all registered tools
2. Test tool invocations
3. Inspect response structures

### Building Widgets

```bash
# Build React widgets for production
pnpm build:chatgpt-ui

# The built files are in apps/chatgpt-ui/dist/
```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (never expose client-side) |
| `API_BASE_URL` | Internal API URL (e.g., `http://localhost:3000`) |

### Optional

| Variable | Description |
|----------|-------------|
| `PORT` | MCP server port (default: `8787`) |
| `OPENAI_API_KEY` | Required for crawler tool summarization |
| `SUPABASE_EDGE_URL` | Edge Functions URL for crawler |
| `OPENAI_VECTOR_STORE_AUTHORITIES_ID` | Vector store ID for corpus |

## Deployment

### Option 1: Railway / Fly.io / Render

1. Create a new service pointing to the `apps/mcp` directory
2. Set build command: `pnpm build`
3. Set start command: `node dist/server.js`
4. Configure environment variables
5. Expose port 8787 (or your custom PORT)

### Option 2: Cloudflare Workers

The MCP server uses standard Node.js HTTP. For Cloudflare Workers compatibility:

1. Adapt `src/server.ts` to use `export default { fetch }` pattern
2. Use `@cloudflare/workers-types`
3. Replace `node:fs` operations with KV storage or inline widgets

### Option 3: Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY apps/mcp/package.json apps/mcp/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY apps/mcp/ ./
RUN pnpm build
EXPOSE 8787
CMD ["node", "dist/server.js"]
```

## App Store Submission Checklist

### Before Submission

- [ ] **MCP Server deployed** with HTTPS endpoint accessible publicly
- [ ] **All tools tested** via MCP Inspector with real data
- [ ] **Tool annotations verified**:
  - `readOnlyHint: true` for read-only tools
  - `openWorldHint: true` for tools calling external APIs
  - `destructiveHint: false/true` set appropriately
- [ ] **Privacy policy** URL prepared
- [ ] **Support contact** email configured
- [ ] **Demo credentials** for reviewer (org_id, user_id with sample data)

### Tool Annotation Reference

| Tool | readOnlyHint | openWorldHint | destructiveHint |
|------|--------------|---------------|-----------------|
| corpus.search | ✓ true | false | false |
| corpus.get_document | ✓ true | false | false |
| corpus.get_chunks | ✓ true | false | false |
| corpus.resummarize | false | false | false |
| crawler.run_authorities | false | ✓ true | false |
| governance.metrics | ✓ true | false | false |
| governance.snapshot_perf | false | false | false |
| governance.snapshot_slo | false | false | false |
| governance.list_slo | ✓ true | false | false |
| governance.transparency_report | false | false | false |
| release.go_no_go_check | ✓ true | false | false |

### Submission Portal Steps

1. Go to [ChatGPT App Store dashboard](https://platform.openai.com/apps)
2. Create new app → Enter name: "Lawai Legal Corpus"
3. Configure MCP endpoint: `https://your-deployed-mcp-server.com/mcp`
4. Add app description (max 500 chars):
   > "AI-powered legal corpus assistant for francophone jurisdictions. Search laws, track governance metrics, and verify release readiness with CEPEJ/FRIA compliance reporting."
5. Upload app icon (512x512 PNG)
6. Configure permissions: "Database read/write" for write tools
7. Add test credentials in reviewer notes
8. Submit for review

## Troubleshooting

### "Tool not found" errors

Ensure the MCP server is running and accessible. Check:
- Server logs for registration errors
- Network access from ChatGPT's infrastructure

### CORS issues in local development

The MCP server includes CORS headers for `*`. If issues persist:
```bash
# Check response headers
curl -I http://localhost:8787/mcp
```

### Widget not rendering

Verify:
1. `text/html+skybridge` mime type is set on resources
2. Widget HTML is valid (check browser console)
3. `window.openai` object exists in widget context

### Database connection errors

Check environment variables. Service role key must have access to all queried tables.

## Security Considerations

1. **Never expose** `SUPABASE_SERVICE_ROLE_KEY` in client code
2. **Validate** orgId/userId in all tool handlers
3. **Rate limit** write operations in production
4. **Audit log** sensitive operations to `audit_events` table
5. **Review** App Store guidelines before each submission

## Related Documentation

- [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/quickstart)
- [MCP Server Guide](https://developers.openai.com/apps-sdk/build/mcp-server)
- [App Submission Guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines)
- [UI Guidelines](https://developers.openai.com/apps-sdk/concepts/ui-guidelines)
