import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VoiceConsolePanel } from "@/components/voice/VoiceConsolePanel";
import type { VoiceRunResponse } from "@avocat-ai/shared";

const response: VoiceRunResponse = {
  summary: "Résumé",
  readback: ["C1"],
  followUps: ["Clarifier"],
  citations: [],
  intents: []
};

describe("VoiceConsolePanel", () => {
  it("invokes callbacks for recording and suggestions", () => {
    const onToggleRecording = vi.fn();
    const onClarification = vi.fn();
    const onBargeIn = vi.fn();
    const onRetryOutbox = vi.fn();

    render(
      <VoiceConsolePanel
        status="idle"
        audioLevel={0.3}
        captions=""
        quickIntents={[{ id: "i1", name: "Geler" }]}
        suggestions={["Suggestion vocale"]}
        guardrails={[]}
        onToggleRecording={onToggleRecording}
        bargeInAvailable
        onBargeIn={onBargeIn}
        history={[]}
        isLoading={false}
        formatDateTime={(value) => value}
        isOnline
        voiceOutbox={[{ id: "o1", channel: "voice", payload: {} as any, queuedAt: "", status: "queued", attempts: 0 }]}
        stalenessMs={60000}
        onRetryOutbox={onRetryOutbox}
        activeResponse={response}
        onClarification={onClarification}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /push-to-talk/i }));
    expect(onToggleRecording).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /interrompre la lecture/i }));
    expect(onBargeIn).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /suggestion vocale/i }));
    expect(onClarification).toHaveBeenCalledWith("Suggestion vocale");

    fireEvent.click(screen.getByRole("button", { name: /relancer/i }));
    expect(onRetryOutbox).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /clarifier/i }));
    expect(onClarification).toHaveBeenCalledWith("Clarifier");
  });
});
