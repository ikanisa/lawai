# PDF File Inputs Streaming Guardrails

This example shows how we stream a `responses.create` call that ingests a PDF
file, and how we harden the loop so it can safely run inside production
workers. The instrumentation mirrors the monitoring hooks we attach in
Avocat AI's agents service.

```ts
import OpenAI from "openai";

const client = new OpenAI();

export async function streamPdfSummary(fileId: string) {
  const abortController = new AbortController();
  const abortOnTimeout = setTimeout(() => {
    abortController.abort();
  }, 60_000);

  const functionArguments = new Map<string, string>();

  const stream = await client.responses.stream(
    {
      model: "gpt-4.1",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Summarise the uploaded PDF" },
            { type: "input_file", file_id: fileId },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          name: "index_case_law",
          description: "Persist extracted citations into the legal search index.",
          parameters: {
            type: "object",
            properties: {
              citations: { type: "array", items: { type: "string" } },
            },
            required: ["citations"],
          },
        },
      ],
    },
    { signal: abortController.signal },
  );

  const cleanup = () => {
    clearTimeout(abortOnTimeout);
    abortController.abort();
  };

  try {
    for await (const event of stream) {
      switch (event.type) {
        case "response.created": {
          console.info("response created", { responseId: event.response.id });
          break;
        }
        case "response.output_text.delta": {
          process.stdout.write(event.delta);
          break;
        }
        case "response.output_text.done": {
          process.stdout.write("\n");
          break;
        }
        case "response.function_call_arguments.delta": {
          const next = (functionArguments.get(event.id) ?? "") + event.delta;
          functionArguments.set(event.id, next);
          break;
        }
        case "response.function_call_arguments.done": {
          const args = functionArguments.get(event.id) ?? "{}";
          console.info("tool call ready", {
            toolCallId: event.id,
            argumentsJson: args,
          });
          break;
        }
        case "response.completed": {
          console.info("response completed", { responseId: event.response.id });
          break;
        }
        case "response.error": {
          console.error("response stream error", event.error ?? event);
          cleanup();
          throw new Error(event.error?.message ?? "Unknown streaming error");
        }
        case "error": {
          console.error("legacy response stream error", event);
          cleanup();
          throw new Error(event.message ?? "Unknown streaming error");
        }
        default: {
          // In production we forward other events to observability sinks.
          break;
        }
      }
    }

    const final = await stream.finalResponse();
    const usage = final.usage ?? {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };
    console.info("token usage", {
      input: usage.input_tokens,
      output: usage.output_tokens,
      total: usage.total_tokens,
    });

    return final;
  } catch (error) {
    throw error;
  } finally {
    cleanup();
  }
}
```

Token accounting happens *after* `finalResponse()` resolves so that we capture
usage from `response.completed` as well as any tool invocations emitted between
the last text delta and the completion event. Handling `response.error` (and its
`error` alias) means we surface infrastructure failures immediately instead of
waiting for a timeout. `response.completed` tells us when the model stops
producing events—production dashboards mark that boundary to detect hung
sessions. Tool-call deltas (`response.function_call_arguments.delta` /
`response.function_call_arguments.done`) feed audit logs that show which
arguments were sent to internal systems.

Finally, we use an `AbortController` both to time out long-running calls and to
coordinate cancellation when upstream services drop the request. Production
runtimes should replace the example timeout with their own SLA budget and ensure
`cleanup()` executes from every early exit path.
