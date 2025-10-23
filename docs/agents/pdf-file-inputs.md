# PDF File Inputs

Guidance for attaching PDF evidence and filings to OpenAI Agents runs.

## Prerequisites
- Node.js ≥18 to access the modern `fetch` implementation required by the official SDK.
- Install the OpenAI Node SDK in your workspace:

```bash
npm install openai
```

- Export your API credential so the SDK can authenticate requests:

```bash
export OPENAI_API_KEY="sk-..."
```

- Review the [OpenAI Node SDK documentation](https://github.com/openai/openai-node#file-uploads) for file upload semantics and retry behaviour already established in our stack.

## TypeScript Example

```ts
import OpenAI from "openai";
import fs from "node:fs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function uploadPdf() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY must be set before uploading files.");
  }

  const pdf = await client.files.create({
    file: fs.createReadStream("./evidence/exhibit-a.pdf"),
    purpose: "agents"
  });

  // Attach the uploaded PDF to a thread or run once created.
  await client.beta.threads.messages.create("thread_123", {
    role: "user",
    content: [
      { type: "input_text", text: "Analyse the attached exhibit." },
      { type: "input_file", file_id: pdf.id }
    ]
  });
}

uploadPdf().catch((error) => {
  console.error("Failed to upload PDF", error);
});
```
