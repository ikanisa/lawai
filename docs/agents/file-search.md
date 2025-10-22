# File Search Integration Guide

OpenAI's File Search tool lets agents retrieve contextual snippets from uploaded documents stored in a managed vector store before composing a response. This guide covers the prerequisites, how to invoke the tool from the Responses API, and the knobs available to control retrieval behaviour.

## Prerequisites

1. **Create a vector store** – Use the OpenAI API or dashboard to create a vector store that will hold your knowledge base.
2. **Upload files** – Ingest the documents you want the model to consult. Supported formats include common text and document types such as Markdown, PDF, Office documents, and source files. Files must use UTF-8/UTF-16/ASCII encodings for text.
3. **Associate the store with your agent** – Provide the vector store IDs when invoking the Responses API so the hosted tool knows where to search.

## Basic Usage

Once your knowledge base is ready, include the `file_search` tool in your Responses API request. The model will call it automatically when it needs additional context.

```python
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-4.1",
    input="What is deep research by OpenAI?",
    tools=[{
        "type": "file_search",
        "vector_store_ids": ["<vector_store_id>"]
    }]
)
print(response)
```

When the tool executes, the API response contains two relevant output items:

- A `file_search_call` entry with the call identifier (and optionally raw results).
- A message payload with the assistant's answer and in-text citations pointing to the source files.

## Retrieval Controls

You can tailor how File Search behaves for latency and cost trade-offs:

- **Limit result count** – Set `max_num_results` on the tool definition to reduce the number of snippets returned.
- **Return raw results** – Pass `include=["file_search_call.results"]` when creating the response to receive the retrieved chunks alongside the answer.
- **Filter by metadata** – Constrain search to files that match metadata filters (e.g., category, jurisdiction) using the `filters` object.

## Metadata Strategy

Attach metadata (such as document category, jurisdiction, confidentiality level, or version tags) at upload time so you can route queries to the right subset of content. Metadata filters are especially helpful when a vector store contains heterogeneous documents spanning multiple domains or regulatory regions.

## Tool Output Handling

When parsing tool output, look for `file_search_call` items and surface the citations in your UI to attribute the model's claims. If you also requested raw results, store them alongside the response for audit trails or debugging.

## Supported File Formats

File Search supports a wide range of document types, including:

| Format | MIME Type |
| --- | --- |
| `.c` | `text/x-c` |
| `.cpp` | `text/x-c++` |
| `.cs` | `text/x-csharp` |
| `.css` | `text/css` |
| `.doc` | `application/msword` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.go` | `text/x-golang` |
| `.html` | `text/html` |
| `.java` | `text/x-java` |
| `.js` | `text/javascript` |
| `.json` | `application/json` |
| `.md` | `text/markdown` |
| `.pdf` | `application/pdf` |
| `.php` | `text/x-php` |
| `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| `.py` | `text/x-python` |
| `.rb` | `text/x-ruby` |
| `.sh` | `application/x-sh` |
| `.tex` | `text/x-tex` |
| `.ts` | `application/typescript` |
| `.txt` | `text/plain` |

Use these tables to validate ingestion pipelines and enforce content governance policies before the files reach production vector stores.
