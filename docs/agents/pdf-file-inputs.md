# PDF File Inputs

## cURL examples

### file_url payload

```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-mini",
    "input": [
      {
        "role": "user",
        "content": [
          {"type": "input_text", "text": "Summarise the attached PDF memo."},
          {"type": "input_file", "file_url": "https://example.com/memo.pdf"}
        ]
      }
    ]
  }'
```

### file_id payload

```bash
# 1. Upload the PDF and capture the returned file id.
curl https://api.openai.com/v1/files \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "file=@/path/to/memo.pdf" \
  -F "purpose=assistants"

# 2. Reference the uploaded file by id when creating the response.
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-mini",
    "input": [
      {
        "role": "user",
        "content": [
          {"type": "input_text", "text": "Extract deadlines from the uploaded brief."},
          {"type": "input_file", "file_id": "file_abc123"}
        ]
      }
    ]
  }'
```

### Node.js / TypeScript (using the shared OpenAI client)

```ts
import fs from 'node:fs';
import path from 'node:path';
import { getOpenAIClient } from '@avocat-ai/shared';

const openai = getOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY!,
  requestTags: 'service=api,component=backend',
});

async function summarizeViaFileUrl() {
  const response = await openai.responses.create({
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Summarise the attached PDF memo in French.',
          },
          {
            type: 'input_file',
            file_url: 'https://example.com/memo.pdf',
          },
        ],
      },
    ],
    // Default (non-streaming) create() keeps the request simple for jobs that can
    // wait for the full response body before resuming workflow logic.
  });

  console.log(response.output_text);
}

async function streamFromUploadedPdf(localFile: string) {
  const upload = await openai.files.create({
    file: fs.createReadStream(path.resolve(localFile)),
    purpose: 'assistants',
  });

  const stream = await openai.responses.stream({
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'List the key deadlines found in the uploaded pleading.',
          },
          {
            type: 'input_file',
            file_id: upload.id,
          },
        ],
      },
    ],
    // stream() opts into SSE for interactive surfaces; only use when the caller
    // can consume incremental tokens to render partial output safely.
  });

  stream.on('response.output_text.delta', (event) => {
    process.stdout.write(event.delta);
  });

  await stream.finalResponse();
  console.log('\nDone.');
}
```
