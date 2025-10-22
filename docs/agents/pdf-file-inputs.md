# PDF File Inputs via the Responses API

The API server accepts PDF evidence from two entry points:

* A direct URL pointing to an external document.
* Binary uploads that land in Supabase storage first.

Both flows share the same OpenAI client configuration so request tagging, retry
policies, and optional organisation/project headers remain consistent with
`apps/api/src/openai.ts`.

## 1. Instantiate the shared OpenAI client

```ts
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OPENAI_API_KEY is required');
}

const requestTags =
  process.env.OPENAI_REQUEST_TAGS_API ??
  process.env.OPENAI_REQUEST_TAGS ??
  'service=api,component=backend';

const defaultHeaders: Record<string, string> = {
  'OpenAI-Beta': 'assistants=v2',
};

if (requestTags) {
  // Tag requests so observability dashboards stay segmented per component.
  defaultHeaders['OpenAI-Request-Tags'] = requestTags;
}
if (process.env.OPENAI_ORGANIZATION) {
  // Forward optional organisation scoping for billing or access control.
  defaultHeaders['OpenAI-Organization'] = process.env.OPENAI_ORGANIZATION;
}
if (process.env.OPENAI_PROJECT) {
  // Attach the project header when the workspace enforces project budgets.
  defaultHeaders['OpenAI-Project'] = process.env.OPENAI_PROJECT;
}

export const openai = new OpenAI({
  apiKey,
  maxRetries: 2,
  timeout: 45_000,
  defaultHeaders,
  organization: process.env.OPENAI_ORGANIZATION,
  project: process.env.OPENAI_PROJECT,
});
```

> ℹ️ Keep the client singleton in module scope so URL uploads and streamed file
> uploads reuse sockets and share retry budgeting.

## 2. URL ingestion flow

```ts
export async function runPdfFromUrl({
  url,
  displayName,
  prompt,
  model,
}: {
  url: string;
  displayName?: string;
  prompt: string;
  model: string;
}) {
  const stream = await openai.responses.stream({
    model,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          {
            type: 'input_file',
            file_url: url,
            display_name: displayName ?? 'uploaded.pdf',
          },
        ],
      },
    ],
    metadata: { purpose: 'pdf_ingestion_url' },
  });

  return stream; // Caller should relay stream events to the SSE channel.
}
```

## 3. Upload flow (Supabase backed)

```ts
import type { Readable } from 'node:stream';

export async function runPdfUpload({
  file,
  filename,
  prompt,
  model,
}: {
  file: Readable | Blob;
  filename: string;
  prompt: string;
  model: string;
}) {
  const created = await openai.files.create({
    file,
    file_name: filename,
    purpose: 'assistants',
  });

  const stream = await openai.responses.stream({
    model,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          {
            type: 'input_file',
            file_id: created.id,
            display_name: filename,
          },
        ],
      },
    ],
    metadata: { purpose: 'pdf_ingestion_upload' },
  });

  return stream;
}
```

> ✅ Do not instantiate a second client in the upload helper—the same `openai`
> instance handles both the file upload and the follow-up `responses.stream`
> call.

## Streaming & token accounting

* Always stream responses so the frontend can surface interim thinking. The Node
  SDK exposes an async iterator, so relay each `event.data` payload to the SSE
  client.
* Call `const final = await stream.finalResponse();` once streaming completes.
  The `final.usage.total_tokens` field powers our Datadog dashboards and quota
  reconciliation.
* Persist `final.response_id`, request tags, and `final.usage` alongside the run
  record so we can audit expensive PDFs later.
* When a stream fails, forward the error to `logOpenAIDebug(...)` with the shared
  client to capture the debugging payload from OpenAI before surfacing a
  user-friendly retry message.

These patterns keep the documentation aligned with the production wiring in
`apps/api/src/openai.ts` while making the example self-contained for agent
builders.
