# Handling PDF file inputs with streaming responses

When you stream a `Responses` API call that processes a PDF upload you need to
handle the entire lifecycle of the stream. The example below expands on the
basic loop so it is safe to run in production monitoring pipelines.

```ts
import { Client } from "@openai/assistants";

const client = new Client({ apiKey: process.env.OPENAI_API_KEY! });
const pdfFileId = "file-abc123"; // ID returned by the file upload endpoint

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30_000);

const stream = await client.responses.stream({
  model: "gpt-4.1",
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: "Extract the key findings" },
        {
          type: "input_file",
          file_id: pdfFileId,
          mime_type: "application/pdf",
        },
      ],
    },
  ],
  signal: controller.signal,
});

try {
  for await (const event of stream) {
    switch (event.type) {
      case "response.output_text.delta":
        process.stdout.write(event.delta);
        break;
      case "response.output_text.done":
        console.log("\nText streaming complete.");
        break;
      case "response.tool_call.delta":
        console.log("Tool call delta", event.delta);
        break;
      case "response.tool_call.done":
        console.log("Tool call result", event.tool_call);
        break;
      case "response.completed":
        console.log("Response completed", event.response.usage);
        break;
      case "response.error":
        console.error("Stream error", event.error);
        throw new Error(event.error.message);
      default:
        console.debug("Unhandled event", event.type);
    }
  }
} catch (error) {
  if ((error as Error).name === "AbortError") {
    console.warn("Stream aborted after timeout");
  } else {
    throw error;
  }
} finally {
  clearTimeout(timeout);
  controller.abort();
}

const final = await stream.finalResponse();
const { total_input_tokens, total_output_tokens } = final.usage;
console.log("Usage", { total_input_tokens, total_output_tokens });
```

Calling `finalResponse()` resolves the accumulated response object while still
preserving token accounting. Logging `final.usage` after the stream ends keeps
observability tooling consistent with synchronous calls. Handling `response.error`
and `response.completed` events gives you early insight into failures and normal
termination without waiting for `finalResponse()`, while tool-call events provide
per-call visibility that is critical when auditors review automated PDF
extractions. The explicit `AbortController` cleanup guarantees that a cancellation
or timeout closes the stream and releases resources before awaiting the final
summary.
