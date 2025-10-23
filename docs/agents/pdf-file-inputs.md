# PDF File Inputs for Agent Runs

This guide shows how to ingest PDFs into the Responses API with a single OpenAI
client. The examples cover remote URL fetches and direct uploads while staying
package-agnostic so they can run inside background workers, API routes, or local
scripts without importing internal helpers.

## Create a shared OpenAI client

```ts
import OpenAI, { toFile } from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('Set OPENAI_API_KEY before creating the OpenAI client.');
}

const requestTags =
  process.env.OPENAI_REQUEST_TAGS_PDF ??
  process.env.OPENAI_REQUEST_TAGS ??
  'service=agents,component=pdf-ingestion';
const organization = process.env.OPENAI_ORGANIZATION;
const project = process.env.OPENAI_PROJECT;

const defaultHeaders: Record<string, string> = {
  'OpenAI-Beta': 'assistants=v2',
};

if (requestTags) {
  defaultHeaders['OpenAI-Request-Tags'] = requestTags;
  // Optional: override with deployment specific request tags when needed.
  // defaultHeaders['OpenAI-Request-Tags'] = 'service=my-app,component=pdf-loader';
}
if (organization) {
  defaultHeaders['OpenAI-Organization'] = organization;
  // Optional: scope usage to an organization when the API key spans orgs.
}
if (project) {
  defaultHeaders['OpenAI-Project'] = project;
  // Optional: attribute usage to a project for billing or analytics.
}

export const openai = new OpenAI({
  apiKey,
  maxRetries: 2,
  timeout: 45_000,
  defaultHeaders,
  organization,
  project,
});
```

The same `openai` instance is reused by both ingestion flows to keep retries,
timeouts, and headers consistent.

## URL-based ingestion

```ts
async function createFileFromUrl(pdfUrl: string) {
  const response = await fetch(pdfUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? 'application/pdf';
  const filename = new URL(pdfUrl).pathname.split('/').at(-1) ?? 'remote.pdf';
  const buffer = Buffer.from(await response.arrayBuffer());
  const file = await toFile(buffer, filename, {
    contentType,
  });

  return openai.files.create({
    file,
    purpose: 'assistants',
  });
}
```

## Direct upload ingestion

```ts
import type { ReadStream } from 'node:fs';

async function createFileFromUpload(stream: ReadStream, filename: string) {
  const file = await toFile(stream, filename, {
    contentType: 'application/pdf',
  });

  return openai.files.create({
    file,
    purpose: 'assistants',
  });
}
```

Both helpers return uploaded file metadata (including `id`) that can be reused in
Responses API calls:

```ts
async function runWithPdf(agentId: string, fileId: string, prompt: string) {
  const stream = await openai.responses.stream({
    model: 'gpt-4.1-mini',
    instructions: prompt,
    metadata: { agentId },
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_file', file_id: fileId },
        ],
      },
    ],
  });

  let output = '';
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      output += event.delta ?? '';
    }
    if (event.type === 'response.completed') {
      inputTokens += event.response.usage?.input_tokens ?? 0;
      outputTokens += event.response.usage?.output_tokens ?? 0;
    }
  }

  return { output, inputTokens, outputTokens };
}
```

### Streaming and token accounting guidance

- Streaming keeps latency low for larger PDFs because `response.output_text.delta`
  events emit incremental tokens that can be relayed directly to clients.
- The `response.completed` event carries cumulative `usage` values. Capture both
  `input_tokens` and `output_tokens` for billing dashboards and guardrail logic.
- For background jobs, persist the final token counts with the PDF source so
  reruns or escalations can reference the stored metrics without replaying the
  stream.
- When live tokens are not required, call `await stream.finalResponse()` to
  retrieve the same totals after the stream closes.

With this structure, the URL and upload workflows share a single, fully
configured OpenAI client, optional headers remain easy to adjust, and the
streaming/token guidance mirrors production usage patterns.
