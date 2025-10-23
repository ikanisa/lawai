import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { startResearchRun, type WebSearchMode } from "@/lib/data/research";
import { apiFetch } from "@/lib/apiClient";
import { consumeEventStream } from "@/lib/openaiStream";

vi.mock("@/lib/apiClient", () => ({
  apiFetch: vi.fn()
}));

vi.mock("@/lib/openaiStream", () => ({
  consumeEventStream: vi.fn(async (_response: Response, handler: (event: unknown) => void) => {
    handler({ type: "done", data: {} });
  }),
  parseSseLine: vi.fn()
}));

describe("startResearchRun", () => {
  const apiFetchMock = vi.mocked(apiFetch);
  const consumeStreamMock = vi.mocked(consumeEventStream);
  const originalFetch = global.fetch;

  beforeEach(() => {
    apiFetchMock.mockReset();
    consumeStreamMock.mockClear();
    global.fetch = vi.fn(() => Promise.resolve(new Response("{}"))) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const runPayload = {
    id: "run_1",
    agentId: "research",
    threadId: "thread_1",
    status: "running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    input: "Question",
    jurisdiction: null,
    policyFlags: [],
    webSearchMode: "allowlist" as WebSearchMode
  };

  it.each<[WebSearchMode | undefined, WebSearchMode]>([
    [undefined, "allowlist"],
    ["broad", "broad"],
    ["disabled", "disabled"]
  ])("sends %s web search mode in the run request", async (mode, expected) => {
    apiFetchMock.mockResolvedValueOnce({ ...runPayload, webSearchMode: expected });

    const stop = startResearchRun(
      "Analyse du dossier",
      vi.fn(),
      {
        agentId: "research",
        toolsEnabled: [],
        webSearchMode: mode
      }
    );

    await Promise.resolve();

    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ web_search_mode: expected })
      })
    );

    stop();
  });
});
