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
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const malformed = "not-json";
    expect(parseSseLine(malformed)).toBeNull();
    consoleSpy.mockRestore();
  });

  it("reassembles events split across chunks", async () => {
    const encoder = new TextEncoder();
    const payloads = [
      JSON.stringify({ type: "token", data: { token: "Bon" } }),
      JSON.stringify({ type: "token", data: { token: "jour" } }),
      JSON.stringify({ type: "done", data: {} })
    ].join("\n");

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(payloads.slice(0, 25)));
        controller.enqueue(encoder.encode(payloads.slice(25)));
        controller.close();
      }
    });

    const received: StreamEvent[] = [];
    await consumeEventStream(new Response(stream), (event) => received.push(event));

    expect(received).toHaveLength(3);
    expect(received.map((event) => event.type)).toEqual(["token", "token", "done"]);
  });

  it("flushes trailing buffers when the stream closes", async () => {
    const encoder = new TextEncoder();
    const fragments = [
      JSON.stringify({ type: "token", data: { token: "Encore" } }),
      JSON.stringify({ type: "done", data: {} })
    ];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`${fragments[0]}\n`));
        controller.enqueue(encoder.encode(fragments[1]));
        controller.close();
      }
    });

    const received: StreamEvent[] = [];
    await consumeEventStream(new Response(stream), (event) => received.push(event));

    expect(received.map((event) => event.type)).toEqual(["token", "done"]);
  });

  it("continues consumption across reconnections", async () => {
    const encoder = new TextEncoder();
    const firstStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "token", data: { token: "Phase1" } })}\n`));
        controller.close();
      }
    });
    const secondStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "risk", data: { risk: { level: "LOW" } } })}\n`));
        controller.enqueue(encoder.encode(JSON.stringify({ type: "done", data: {} })));
        controller.close();
      }
    });

    const received: StreamEvent[] = [];
    await consumeEventStream(new Response(firstStream), (event) => received.push(event));
    await consumeEventStream(new Response(secondStream), (event) => received.push(event));

    expect(received.map((event) => event.type)).toEqual(["token", "risk", "done"]);
  });

  it("ignores SSE frames without a type field", () => {
    expect(parseSseLine(JSON.stringify({ data: { token: "x" } }))).toBeNull();
  });
});
