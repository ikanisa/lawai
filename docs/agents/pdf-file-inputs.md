# PDF File Inputs

Use these patterns to accept PDF documents with the Responses API when building Avocat agents.

## cURL

### Provide a PDF by URL

```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-mini",
    "input": [{
      "role": "user",
      "content": [
        {"type": "input_text", "text": "Summarise the obligations in this contract."},
        {"type": "input_file", "file_url": "https://example.com/contracts/nda.pdf", "filename": "nda.pdf"}
      ]
    }],
    "tools": [{"type": "file_search"}],
    "metadata": {"flow": "url"}
  }'
```

### Upload a PDF and reference the file ID

```bash
FILE_ID=$(curl https://api.openai.com/v1/files \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "purpose=assistants" \
  -F "file=@/path/to/contract.pdf" | jq -r '.id')

curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-mini",
    "input": [{
      "role": "user",
      "content": [
        {"type": "input_text", "text": "Highlight renewal clauses in the uploaded contract."},
        {"type": "input_file", "file_id": "'"$FILE_ID"'"}
      ]
    }],
    "tools": [{"type": "file_search"}],
    "metadata": {"flow": "upload"}
  }'
```

## Node.js / TypeScript Example (OpenAI SDK)

```ts
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { getOpenAIClient } from '@avocat-ai/shared';

const openai = getOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY!,
  cacheKeySuffix: 'docs-pdf-demo',
  requestTags: process.env.OPENAI_REQUEST_TAGS ?? 'service=docs,component=pdf-inputs',
});

export async function summarizePdfFromUrl(fileUrl: string) {
  const response = await openai.responses.create({
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'List key obligations from the attached PDF.' },
          { type: 'input_file', file_url: fileUrl, filename: basename(new URL(fileUrl).pathname) },
        ],
      },
    ],
    tools: [{ type: 'file_search' }],
    metadata: { flow: 'url' },
  });

  // Persist usage so internal dashboards stay in sync with billing.
  console.info('URL flow tokens', response.usage);
  return response.output_text;
}

export async function summarizeUploadedPdf(filePath: string) {
  const file = await openai.files.create({
    purpose: 'assistants',
    file: createReadStream(filePath),
  });

  const stream = await openai.responses.stream({
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'Surface renewal clauses and cite page numbers.' },
          { type: 'input_file', file_id: file.id },
        ],
      },
    ],
    tools: [{ type: 'file_search' }],
    metadata: { flow: 'upload' },
  });

  let streamedText = '';
  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      streamedText += event.delta;
      process.stdout.write(event.delta);
    }
  }

  const final = await stream.finalResponse();
  // Token usage is only emitted in the final payload when streaming; cache it before returning.
  console.info('Uploaded flow tokens', final.usage);
  return { streamedText, usage: final.usage };
}
```
