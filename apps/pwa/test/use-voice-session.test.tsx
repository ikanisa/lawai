import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

import { useVoiceSession } from "@/lib/hooks/useVoiceSession";
import { voiceConsoleContextQueryOptions } from "@/lib/queries/voice";

const enqueueMock = vi.fn();
const markComplete = vi.fn();
const markFailed = vi.fn();
const markSyncing = vi.fn();

vi.mock("@/lib/telemetry", () => ({
  useTelemetry: () => ({ emit: vi.fn() })
}));

vi.mock("@/lib/voiceClient", () => ({
  VoiceClient: class {
    constructor(private options: { onTranscript?: (chunk: string) => void; onStateChange?: (state: string) => void }) {
      this.options.onStateChange?.("idle");
    }
    async connect() {
      this.options.onStateChange?.("recording");
      return { id: "session" } as const;
    }
    async disconnect() {
      this.options.onStateChange?.("idle");
    }
    emitTranscript(chunk: string) {
      this.options.onTranscript?.(chunk);
    }
  }
}));

vi.mock("@/lib/offline/outbox", () => ({
  useOutbox: () => ({
    items: [] as any[],
    enqueue: enqueueMock.mockImplementation(({ payload }) => ({
      id: "outbox_1",
      channel: "voice",
      payload,
      queuedAt: new Date().toISOString(),
      status: "queued",
      attempts: 0
    })),
    markComplete,
    markFailed,
    markSyncing,
    isOnline: false,
    stalenessMs: 0
  })
}));

vi.mock("@/lib/queries/voice", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queries/voice")>("@/lib/queries/voice");
  return {
    ...actual,
    submitVoiceRun: vi.fn().mockResolvedValue({
      summary: "",
      readback: [],
      followUps: [],
      citations: [],
      intents: []
    })
  };
});

describe("useVoiceSession", () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    enqueueMock.mockClear();
    queryClient.clear();
    queryClient.setQueryData(voiceConsoleContextQueryOptions().queryKey, {
      suggestions: ["Clarifie la mesure"],
      guardrails: []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("queues voice submissions while offline", async () => {
    const notify = vi.fn();
    const { result } = renderHook(() => useVoiceSession({ locale: "fr", notify }), { wrapper });

    await act(async () => {
      await result.current.handleClarification("Procédure d'appel");
    });

    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(result.current.history[0]?.status).toBe("queued");
    expect(result.current.history[0]?.outboxId).toBe("outbox_1");
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/hors ligne/i) })
    );
  });
});
