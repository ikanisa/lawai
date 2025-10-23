# PDF File Inputs

This guide shows how to accept PDF uploads in an OpenAI Agent workflow and feed them into a response request.

## Upload flow overview
1. Upload the PDF to the Files API with the `assistants` purpose.
2. Reference the uploaded file ID inside a response payload.
3. Inspect the streamed or synchronous response for completions grounded in the PDF content.

## Prerequisites
- Install the official Node.js SDK: `npm install openai`.
- Use Node.js 18 or newer so the native `fetch` and file APIs are available.
- Set the `OPENAI_API_KEY` environment variable (for example, `export OPENAI_API_KEY=...`).

For deeper context, review the [OpenAI Node SDK reference](https://github.com/openai/openai-node) and the internal integration guidance in [`docs/agents/platform-migration.md`](./platform-migration.md).

## TypeScript example
```ts
import OpenAI from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function summarizePdf() {
  const pdf = await client.files.create({
    file: createReadStream("./briefs/sample.pdf"),
    purpose: "assistants",
  });

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Summarize the attached brief." },
          { type: "input_file", file_id: pdf.id },
        ],
      },
    ],
  });

  console.log(response.output_text);
}

summarizePdf().catch((error) => {
  console.error("Failed to summarize PDF", error);
  process.exit(1);
});
```
