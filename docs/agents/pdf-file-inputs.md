# PDF File Inputs (Agents SDK)

Use the Agents SDK to hand off PDFs to your legal workflows so that hosted File
Search and guardrail checks stay consistent with the rest of the orchestrator.

## Prerequisites

- Install the OpenAI Node SDK in your workspace: `npm install openai`.
- Run on Node.js v18 or later (aligns with the minimum runtime supported by the
  official Agents SDK and file APIs).
- Export required environment variables: `OPENAI_API_KEY` (API authentication),
  `OPENAI_ORG_ID` (if your project is scoped to an organisation), and
  `OPENAI_PROJECT_ID` (project binding for Agents and file uploads).
  - Refer to the official docs for deeper setup:
    - [OpenAI Node SDK docs][node-sdk-docs]
    - [Agents file inputs guide][agents-file-inputs]

## SDK snippet

```ts
import fs from 'node:fs';
import OpenAI from 'openai';

const client = new OpenAI();

async function summarisePdf() {
  const pdfFile = await client.files.create({
    file: fs.createReadStream('evidence/dossier.pdf'),
    purpose: 'assistants',
  });

  const response = await client.responses.create({
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Analyse the PDF and list the regulatory deadlines.',
          },
          { type: 'input_file', file_id: pdfFile.id },
        ],
      },
    ],
  });

  console.log(response.output_text);
}

summarisePdf().catch(console.error);
```

[node-sdk-docs]: https://github.com/openai/openai-node
[agents-file-inputs]: https://platform.openai.com/docs/guides/agents/file-uploads
