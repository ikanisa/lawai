import { describe, expect, it } from "vitest";

import { consumeEventStream, parseSseLine, type StreamEvent } from "@/lib/openaiStream";

describe("chat streaming integration", () => {
  it("parses incremental SSE payloads into events", async () => {
    const lines = [
      JSON.stringify({ type: "token", data: { token: "Bonjour" } }),
      JSON.stringify({ type: "tool", data: { tool: { id: "tool-1", status: "running", detail: "start" } } }),
      JSON.stringify({ type: "citation", data: { citation: { id: "c1" } } }),
      JSON.stringify({ type: "risk", data: { risk: { level: "LOW", summary: "Faible" } } }),
      JSON.stringify({ type: "done", data: {} })
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        lines.forEach((line) => controller.enqueue(encoder.encode(`${line}\n`)));
        controller.close();
      }
    });

    const response = new Response(stream);
    const received: StreamEvent[] = [];
    await consumeEventStream(response, (event) => received.push(event));

    expect(received).toHaveLength(lines.length);
    expect(received[0].type).toBe("token");
    expect(received[2].type).toBe("citation");
    expect(received.at(-1)?.type).toBe("done");
  });

  it("returns null for malformed JSON lines", () => {
    const malformed = "not-json";
    expect(parseSseLine(malformed)).toBeNull();
  });
});
