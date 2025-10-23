# PDF File Inputs Agent Streaming Guide

When streaming responses for large PDF ingestion tasks, we rely on deterministic
logging and guardrails to keep the orchestration service observable. The loop
below expands on the basic example to surface completion, tool-call, and error
signals while still collecting usage metrics once the final response arrives.

```ts
import OpenAI from "openai";

const client = new OpenAI();

async function streamPdfIngestion(prompt: string) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 120_000);

  const stream = await client.responses.stream(
    {
      model: "gpt-4.1",
      input: prompt,
      tools: [{ type: "file_search" }],
      metadata: { workflow: "pdf-file-inputs" },
    },
    { signal: abortController.signal }
  );

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    for await (const event of stream) {
      switch (event.type) {
        case "response.created":
          console.log(`response ${event.response.id} started`);
          break;
        case "response.completed":
          console.log("response completed");
          break;
        case "response.error":
          console.error("stream error", event.error);
          throw new Error(event.error.message);
        case "response.output_text.delta":
          process.stdout.write(event.delta);
          break;
        case "response.output_text.done":
          process.stdout.write("\n");
          break;
        case "response.tool_call.created":
          console.log(
            `tool call ${event.tool_call.type} → ${event.tool_call.name ?? "<anonymous>"}`
          );
          break;
        case "response.tool_call.delta":
          console.log("tool payload delta", event.delta);
          break;
        case "response.tool_call.done":
          console.log("tool call result", event.tool_call);
          break;
        default:
          console.debug("unhandled event", event.type);
      }
    }

    const final = await stream.finalResponse();
    totalInputTokens += final.usage?.input_tokens ?? 0;
    totalOutputTokens += final.usage?.output_tokens ?? 0;

    console.log({ totalInputTokens, totalOutputTokens });
    return final;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError"
    ) {
      console.warn("stream aborted", error);
    } else {
      throw error;
    }
  } finally {
    clearTimeout(timeout);
    abortController.abort();
  }
}

await streamPdfIngestion(
  "Summarise latest filings from the Banque de France bulletin PDF."
);
```

The `AbortController` enables callers to cancel the long-running ingestion if
orchestration detects staleness or upstream throttling, matching production
safeguards that prevent runaway sessions. Handling `response.error`,
`response.completed`, and the tool-call lifecycle keeps telemetry aligned with
what the agent actually attempted; without those signals our monitoring would
miss failed vector-store lookups, suppressed completions, or early
terminations. Because we still call `finalResponse()` after the loop, token
usage metrics remain accurate even when intermediate events trigger logging or
cancellation logic.
