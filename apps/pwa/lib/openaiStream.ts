export type StreamMessageType = "token" | "tool" | "citation" | "risk" | "done";

export interface StreamEvent<TData = unknown> {
  type: StreamMessageType;
  data: TData;
}

export function parseSseLine<T>(line: string): StreamEvent<T> | null {
  try {
    if (!line.trim()) return null;
    const event = JSON.parse(line);
    if (typeof event.type !== "string") return null;
    return event as StreamEvent<T>;
  } catch (error) {
    console.error("Failed to parse SSE line", error);
    return null;
  }
}

export async function consumeEventStream<T>(
  response: Response,
  onEvent: (event: StreamEvent<T>) => void
) {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const event = parseSseLine<T>(line);
      if (event) {
        onEvent(event);
      }
    }
  }

  if (buffer.trim()) {
    const event = parseSseLine<T>(buffer);
    if (event) {
      onEvent(event);
    }
  }
}
