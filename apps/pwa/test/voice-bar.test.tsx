import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { VoiceBar, type VoiceBarClient } from "@/components/voice/VoiceBar";
import { TelemetryProvider } from "@/lib/telemetry";
import { I18nProvider } from "@/lib/i18n";
import type { VoiceSessionOptions } from "@/lib/voiceClient";

describe("VoiceBar", () => {
  it("toggles recording state and surfaces transcripts", async () => {
    const onTranscript = vi.fn();

    class StubClient implements VoiceBarClient {
      private options: VoiceSessionOptions;
      constructor(options: VoiceSessionOptions) {
        this.options = options;
      }
      async connect() {
        this.options.onStateChange?.("connecting");
        this.options.onStateChange?.("recording");
        this.options.onTranscript?.("Bonjour");
        return { token: "stub-token", expires_at: new Date().toISOString() };
      }
      async disconnect() {
        this.options.onStateChange?.("idle");
      }
      emitTranscript(text: string) {
        this.options.onTranscript?.(text);
      }
      getSession() {
        return { token: "stub-token" };
      }
    }

    render(
      <TelemetryProvider>
        <I18nProvider initialLocale="fr">
          <VoiceBar onTranscript={onTranscript} clientFactory={(options) => new StubClient(options)} />
        </I18nProvider>
      </TelemetryProvider>
    );

    const toggle = screen.getByTestId("voice-bar-toggle");
    expect(toggle).toHaveTextContent(/dictée/i);

    const user = userEvent.setup();
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveTextContent(/arrêter/i));

    await user.click(toggle);
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith("Bonjour"));
    expect(toggle).toHaveTextContent(/dictée/i);
  });
});
