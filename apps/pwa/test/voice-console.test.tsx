import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

import { VoiceConsole } from "@/components/voice/VoiceConsole";
import type { VoiceRunRequest, VoiceRunResponse } from "@avocat-ai/shared";

const telemetryEmitMock = vi.fn();
const mockUseQuery = vi.fn();
const toastMock = vi.fn();
const enqueueMock = vi.fn((item: { channel: string; payload: VoiceRunRequest }) => enqueueFactory(item));
const markCompleteMock = vi.fn();
const markFailedMock = vi.fn();
const markSyncingMock = vi.fn();

const outboxState = {
  items: [] as Array<{ id: string; channel: string; status: string; payload: VoiceRunRequest; attempts: number }>,
  isOnline: true,
  stalenessMs: 0
};

function enqueueFactory(item: { channel: string; payload: VoiceRunRequest }) {
  const entry = {
    id: `outbox_${Date.now()}`,
    queuedAt: new Date().toISOString(),
    status: "queued" as const,
    attempts: 0,
    ...item
  };
  outboxState.items = [entry, ...outboxState.items];
  return entry;
}

enqueueMock.mockImplementation(enqueueFactory);

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args)
  };
});

vi.mock("@/lib/telemetry", () => ({
  useTelemetry: () => ({ emit: telemetryEmitMock })
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock, dismiss: vi.fn() })
}));

vi.mock("@/lib/i18n/provider", () => ({
  useLocale: () => ({
    locale: "fr",
    formatDateTime: (iso: string) => iso
  })
}));

vi.mock("framer-motion", () => {
  const motion = new Proxy(
    {},
    {
      get: (_target, key: string) => {
        const Tag = key as keyof JSX.IntrinsicElements;
        return ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
          <Tag {...props}>{children}</Tag>
        );
      }
    }
  );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion
  };
});

const submitVoiceRunMock = vi.fn<Promise<VoiceRunResponse>, [VoiceRunRequest]>();

vi.mock("@/lib/queries/voice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queries/voice")>();
  return {
    ...actual,
    submitVoiceRun: (...args: Parameters<typeof submitVoiceRunMock>) => submitVoiceRunMock(...args)
  };
});

vi.mock("@/lib/offline/outbox", () => ({
  useOutbox: () => ({
    items: outboxState.items,
    isOnline: outboxState.isOnline,
    stalenessMs: outboxState.stalenessMs,
    enqueue: enqueueMock,
    markComplete: markCompleteMock,
    markFailed: markFailedMock,
    markSyncing: markSyncingMock
  })
}));

type ClientOptions = {
  onTranscript?: (chunk: string) => void;
  onStateChange?: (state: "idle" | "recording" | "connecting") => void;
  onAudioLevel?: (level: number) => void;
};

const connectMock = vi.fn();
const disconnectMock = vi.fn();
let connectBehavior: ((this: { options: ClientOptions }) => Promise<unknown>) | null = null;

vi.mock("@/lib/voiceClient", () => {
  class MockVoiceClient {
    options: ClientOptions;

    constructor(options: ClientOptions = {}) {
      this.options = options;
    }

    async connect() {
      connectMock();
      if (connectBehavior) {
        return connectBehavior.call(this);
      }
      this.options.onStateChange?.("recording");
      this.options.onTranscript?.("Résumé initial");
      return { token: "session" };
    }

    async disconnect() {
      disconnectMock();
      this.options.onStateChange?.("idle");
      return Promise.resolve();
    }

    emitTranscript(text: string) {
      this.options.onTranscript?.(text);
    }
  }

  return {
    VoiceClient: MockVoiceClient
  };
});

const voiceContext = {
  suggestions: ["Vérifie la compétence", "Ajoute la citation"],
  guardrails: ["Realtime limité aux juridictions OHADA"],
  quickIntents: [{ id: "intent-1", name: "Comparer" }]
};

describe("VoiceConsole", () => {
  beforeEach(() => {
    telemetryEmitMock.mockClear();
    toastMock.mockClear();
    submitVoiceRunMock.mockReset();
    enqueueMock.mockClear();
    markCompleteMock.mockClear();
    markFailedMock.mockClear();
    markSyncingMock.mockClear();
    outboxState.items = [];
    outboxState.isOnline = true;
    outboxState.stalenessMs = 0;
    mockUseQuery.mockReturnValue({ data: voiceContext, isLoading: false });
    connectMock.mockClear();
    disconnectMock.mockClear();
    connectBehavior = null;
  });

  it("renders the console with context data", async () => {
    render(<VoiceConsole />);

    expect(await screen.findByText("Console vocale")).toBeInTheDocument();
    expect(screen.getByText("Vérifie la compétence")).toBeInTheDocument();
    expect(screen.getByText("Realtime limité aux juridictions OHADA")).toBeInTheDocument();
  });

  it("queues offline submissions and surfaces a toast", async () => {
    outboxState.isOnline = false;

    connectBehavior = async function (this: MockVoiceClient) {
      this.options.onStateChange?.("recording");
      this.options.onTranscript?.("Demande hors ligne");
      return {};
    };

    render(<VoiceConsole />);

    const pushToTalk = await screen.findByRole("button", { name: "Push-to-talk" });
    await act(async () => {
      fireEvent.click(pushToTalk);
    });

    await waitFor(() => {
      expect(screen.getByText("Enregistrement")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Hors ligne — réponse en attente"
        })
      );
    });

    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({ channel: "voice" }));
    expect(submitVoiceRunMock).not.toHaveBeenCalled();
    expect(telemetryEmitMock).toHaveBeenCalledWith(
      "voice_stopped",
      expect.objectContaining({ agentId: "voice_concierge" })
    );
    expect(screen.getByText("En attente hors ligne")).toBeInTheDocument();
  });

  it("processes runs online and transitions to playback", async () => {
    const response: VoiceRunResponse = {
      id: "voice_run_1",
      summary: "Plan vocal proposé",
      readback: ["Citation 1", "Citation 2"],
      followUps: ["Demander confirmation"],
      citations: [
        { id: "c1", label: "Acte uniforme", snippet: "Art. 3", href: "https://ohada.org" }
      ],
      intents: [
        { id: "intent-1", name: "Planification", status: "completed" }
      ]
    } as VoiceRunResponse;

    submitVoiceRunMock.mockResolvedValueOnce(response);

    connectBehavior = async function (this: MockVoiceClient) {
      this.options.onStateChange?.("recording");
      this.options.onTranscript?.("Demande en ligne");
      return {};
    };

    render(<VoiceConsole />);

    const pushToTalk = await screen.findByRole("button", { name: "Push-to-talk" });
    await act(async () => {
      fireEvent.click(pushToTalk);
    });

    await waitFor(() => {
      expect(screen.getByText("Enregistrement")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Lecture")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Plan vocal proposé").length).toBeGreaterThan(0);
    expect(submitVoiceRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: "Demande en ligne" })
    );
    expect(telemetryEmitMock).toHaveBeenCalledWith(
      "voice_started",
      expect.objectContaining({ locale: "fr" })
    );
    expect(telemetryEmitMock).toHaveBeenCalledWith(
      "voice_stopped",
      expect.objectContaining({ agentId: "voice_concierge" })
    );
    expect(telemetryEmitMock).toHaveBeenCalledWith(
      "voice_latency_measured",
      expect.objectContaining({ runId: expect.any(String) })
    );
  });
});
