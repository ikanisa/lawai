# PDF File Inputs

Use the shared OpenAI client so file uploads and assistant runs stay aligned
with the platform defaults.
This preserves the beta Assistants headers, retry windows, and observability tags.

## Client initialisation and helpers

```ts
import OpenAI from 'openai';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('Missing OPENAI_API_KEY environment variable.');
}

const defaultHeaders: Record<string, string> = {
  'OpenAI-Beta': 'assistants=v2',
};

const requestTags = process.env.OPENAI_REQUEST_TAGS; // Optional: request tags.
if (requestTags && !defaultHeaders['OpenAI-Request-Tags']) {
  defaultHeaders['OpenAI-Request-Tags'] = requestTags;
}

const organization = process.env.OPENAI_ORGANIZATION; // Optional: scope to an org.
const project = process.env.OPENAI_PROJECT; // Optional: scope usage to a project.

export const client = new OpenAI({
  apiKey,
  defaultHeaders,
  organization,
  project,
  timeout: 45_000,
  maxRetries: 2,
});

export async function uploadPdfFromPath(filePath: string) {
  return client.files.create({
    file: createReadStream(filePath),
    filename: basename(filePath),
    purpose: 'assistants',
  });
}

export async function uploadPdfFromUrl(url: string, filename?: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const resolvedName =
    filename ??
    new URL(url).pathname
      .split('/')
      .filter(Boolean)
      .pop() ??
    'document.pdf';

  return client.files.create({
    file: buffer,
    filename: resolvedName,
    purpose: 'assistants',
  });
}
```

> ℹ️ Continue to use `client.responses.stream(...)` (or the Realtime equivalent)
> after the file is attached to a run when you need incremental deltas.
>
> 🧮 Uploaded PDFs count toward `input_tokens` once referenced in a run—monitor
> `response.usage.total_tokens` to track ingestion and reasoning costs.
