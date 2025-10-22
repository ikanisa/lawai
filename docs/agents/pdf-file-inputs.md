# Using PDF File Inputs with the OpenAI API

OpenAI multimodal models can ingest PDF documents alongside text instructions. This guide covers the supported delivery methods, sample API calls, and operational limits to consider before rolling out PDF-powered workflows.

## How PDF Ingestion Works

For every PDF you submit, OpenAI extracts machine-readable text and captures an image of each page. Both the extracted text and the rendered page images are placed into the model context so that the model can reason over structured content, diagrams, and annotations simultaneously.

## Supplying PDFs via URL

You can link an externally hosted PDF directly in a response request by referencing the URL in an `input_file` content block.

```bash
curl "https://api.openai.com/v1/responses" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
        "model": "gpt-5",
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": "Analyze the letter and provide a summary of the key points."
                    },
                    {
                        "type": "input_file",
                        "file_url": "https://www.berkshirehathaway.com/letters/2024ltr.pdf"
                    }
                ]
            }
        ]
    }'
```

## Uploading PDFs with the Files API

Upload a PDF to OpenAI's file storage first, then reference the returned `file_id` in your response request. Use the `user_data` purpose for files you plan to reuse as inputs.

```bash
curl https://api.openai.com/v1/files \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -F purpose="user_data" \
    -F file="@draconomicon.pdf"

curl "https://api.openai.com/v1/responses" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
        "model": "gpt-5",
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_file",
                        "file_id": "file-6F2ksmvXxt4VdoqmHRw6kL"
                    },
                    {
                        "type": "input_text",
                        "text": "What is the first dragon in the book?"
                    }
                ]
            }
        ]
    }'
```

## Sending Base64-Encoded PDFs

For environments where direct file uploads are not possible, embed the PDF data as a Base64 string inside the request payload.

```bash
curl "https://api.openai.com/v1/responses" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
        "model": "gpt-5",
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_file",
                        "filename": "draconomicon.pdf",
                        "file_data": "...base64 encoded PDF bytes here..."
                    },
                    {
                        "type": "input_text",
                        "text": "What is the first dragon in the book?"
                    }
                ]
            }
        ]
    }'
```

## Usage Considerations

- **Token usage** – Each PDF contributes both extracted text and rendered page images to the context window. Evaluate model pricing and context limits before sending large or numerous PDFs.
- **File size** – Individual files must be smaller than 10 MB. The total content size across all files included in a single request cannot exceed 32 MB.
- **Supported models** – Only multimodal models (e.g. `gpt-4o`, `gpt-4o-mini`, `o1`) accept PDF inputs.
- **File purposes** – While any Files API purpose is allowed, using `user_data` keeps your intent clear for recurring inputs.

## Next Steps

- Prototype prompts with PDF attachments in the Playground to validate the UX before automating calls.
- Review the [Responses API reference](https://api.openai.com/v1/responses) for additional request options, streaming, and output handling patterns.

## Follow-Up Tasks

| Task | Start |
| --- | --- |
| Link this guide from `docs/agents/inventory.md` so migration checklists surface the PDF workflow. | [Start task](../../issues/new?title=Add%20PDF%20inputs%20guide%20to%20agent%20inventory&body=Document%20the%20PDF%20workflow%20in%20docs%2Fagents%2Finventory.md%20and%20other%20navigation%20indices.) |
| Add a TypeScript example that uses the `openai` SDK to upload and send PDFs through the Responses API. | [Start task](../../issues/new?title=Add%20TypeScript%20PDF%20upload%20example&body=Expand%20docs%2Fagents%2Fpdf-file-inputs.md%20with%20an%20SDK-based%20example%20aligned%20with%20apps%2Fapi%20integration%20patterns.) |
| Audit duplicate workspaces (`JB/`, `francophone-lex/`) and merge or remove them to prevent drift. | [Start task](../../issues/new?title=Rationalize%20duplicate%20workspaces&body=Evaluate%20the%20JB%20and%20francophone-lex%20directories%20and%20consolidate%20them%20into%20the%20primary%20workspace.) |
| Track a PDF ingestion rollout milestone in `docs/agents/inventory.md` immediate work items. | [Start task](../../issues/new?title=Track%20PDF%20ingestion%20rollout&body=Add%20a%20checklist%20item%20for%20the%20PDF%20ingestion%20launch%20and%20link%20back%20to%20this%20guide.) |
| Surface a knowledge-base CTA in `apps/web` directing operators to this PDF workflow documentation. | [Start task](../../issues/new?title=Add%20PDF%20CTA%20to%20operator%20console&body=Add%20a%20knowledge-base%20card%20in%20apps%2Fweb%20highlighting%20the%20PDF%20ingestion%20guide%20for%20operators.) |
