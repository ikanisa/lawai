import type { VoiceSessionToken } from "@avocat-ai/shared";

export interface VoiceSessionOptions {
  tokenEndpoint?: string;
  onTranscript?: (text: string) => void;
  onStateChange?: (state: "idle" | "recording" | "connecting") => void;
  onAudioLevel?: (level: number) => void;
}

export class VoiceClient {
  private stream?: MediaStream;
  private options: VoiceSessionOptions;
  private session?: VoiceSessionToken;
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private rafId?: number;

  constructor(options: VoiceSessionOptions = {}) {
    this.options = options;
  }

  async connect(): Promise<VoiceSessionToken> {
    this.options.onStateChange?.("connecting");
    const endpoint = this.options.tokenEndpoint ?? "/api/realtime/session";

    let tokenPayload: VoiceSessionToken;
    try {
      const response = await fetch(endpoint, { method: "POST" });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "voice_session_failed");
      }
      tokenPayload = (await response.json()) as VoiceSessionToken;
    } catch (error) {
      this.options.onStateChange?.("idle");
      throw error;
    }

    this.session = tokenPayload;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      this.options.onStateChange?.("idle");
      throw error;
    }

    this.setupAudioLevelMonitoring();

    this.options.onStateChange?.("recording");
    return tokenPayload;
  }

  async disconnect() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.session = undefined;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = undefined;
    }
    if (this.audioContext) {
      await this.audioContext.close().catch(() => undefined);
      this.audioContext = undefined;
    }
    this.options.onStateChange?.("idle");
  }

  getSession(): VoiceSessionToken | undefined {
    return this.session;
  }

  emitTranscript(text: string) {
    this.options.onTranscript?.(text);
  }

  private setupAudioLevelMonitoring() {
    if (!this.stream) return;
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);
      const dataArray = new Uint8Array(this.analyser.fftSize);

      const update = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i += 1) {
          const value = dataArray[i] / 128 - 1;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        this.options.onAudioLevel?.(Math.min(1, rms * 4));
        this.rafId = requestAnimationFrame(update);
      };
      update();
    } catch (_error) {
      // Ignore audio context errors; VU meter will simply remain idle.
    }
  }
}
