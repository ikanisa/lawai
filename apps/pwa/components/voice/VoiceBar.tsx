"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";

import { Button } from '@avocat-ai/ui';
import { useLocale } from "@/lib/i18n/provider";
import { useTelemetry } from "@/lib/telemetry";
import type { VoiceSessionOptions } from "@/lib/voiceClient";
import { VoiceClient as DefaultVoiceClient } from "@/lib/voiceClient";
import { cn } from "@/lib/utils";

export type VoiceStatus = "idle" | "connecting" | "recording";

export interface VoiceBarClient {
  connect: () => Promise<{ token: string; expires_at: string }>;
  disconnect: () => Promise<void> | void;
  emitTranscript: (text: string) => void;
  getSession: () => { token: string } | undefined;
}

export interface VoiceBarProps {
  onTranscript?: (transcript: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  className?: string;
  clientFactory?: (options: VoiceSessionOptions) => VoiceBarClient;
}

const statusLabels: Record<VoiceStatus, string> = {
  idle: "Dictée",
  connecting: "Connexion",
  recording: "Arrêter"
};

export function VoiceBar({ onTranscript, onStatusChange, className, clientFactory }: VoiceBarProps) {
  const telemetry = useTelemetry();
  const { locale } = useLocale();
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [captions, setCaptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<string>("");
  const startedAtRef = useRef<number | null>(null);
  const clientRef = useRef<VoiceBarClient>();

  const ensureClient = useCallback(() => {
    if (!clientRef.current) {
      const factory = clientFactory ?? ((options: VoiceSessionOptions) => new DefaultVoiceClient(options));
      const client = factory({
        onTranscript: (chunk) => {
          transcriptRef.current = transcriptRef.current
            ? `${transcriptRef.current} ${chunk}`
            : chunk;
          setCaptions(transcriptRef.current);
        },
        onStateChange: (next) => {
          setStatus(next as VoiceStatus);
          onStatusChange?.(next as VoiceStatus);
          if (next === "recording" && !startedAtRef.current) {
            startedAtRef.current = Date.now();
            telemetry.emit("voice_started", { agentId: "workspace_concierge", locale });
          }
        },
        onAudioLevel: (level) => setAudioLevel(level)
      });
      clientRef.current = client;
    }
    return clientRef.current;
  }, [clientFactory, locale, onStatusChange, telemetry]);

  const resetSession = useCallback(() => {
    transcriptRef.current = "";
    setCaptions("");
    startedAtRef.current = null;
    setAudioLevel(0);
  }, []);

  const handleStop = useCallback(async () => {
    const client = ensureClient();
    await client.disconnect();
    const transcript = transcriptRef.current.trim();
    const duration = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    telemetry.emit("voice_stopped", { agentId: "workspace_concierge", durationMs: duration });
    const session = client.getSession();
    telemetry.emit("voice_latency_measured", { runId: session?.token ?? "workspace_local", latencyMs: duration });
    if (transcript && onTranscript) {
      onTranscript(transcript);
    }
    resetSession();
    setStatus("idle");
    onStatusChange?.("idle");
  }, [ensureClient, onStatusChange, onTranscript, resetSession, telemetry]);

  const handleStart = useCallback(async () => {
    setError(null);
    const client = ensureClient();
    try {
      setStatus("connecting");
      onStatusChange?.("connecting");
      await client.connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : "voice_error";
      setError(message);
      setStatus("idle");
      onStatusChange?.("idle");
    }
  }, [ensureClient, onStatusChange]);

  const toggleRecording = useCallback(() => {
    if (status === "recording" || status === "connecting") {
      void handleStop();
    } else {
      void handleStart();
    }
  }, [handleStart, handleStop, status]);

  const statusIcon = useMemo(() => {
    if (status === "connecting") {
      return <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;
    }
    if (status === "recording") {
      return <Square className="h-4 w-4" aria-hidden />;
    }
    return <Mic className="h-4 w-4" aria-hidden />;
  }, [status]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-white",
        className
      )}
    >
      <Button
        type="button"
        variant="secondary"
        className={cn(
          "flex items-center gap-2 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.32em]",
          status === "recording" ? "bg-[#EF4444] text-white" : "bg-white/10 text-white/80"
        )}
        onClick={toggleRecording}
        aria-pressed={status === "recording"}
        data-testid="voice-bar-toggle"
      >
        {statusIcon}
        {statusLabels[status]}
      </Button>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span aria-live="polite" aria-atomic="true">
            {captions ? captions : status === "recording" ? "Captation en cours…" : "Prêt pour une dictée vocale"}
          </span>
        </div>
        <div
          className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(audioLevel * 100)}
        >
          <div
            className="h-full bg-gradient-to-r from-[#22D3EE] to-[#6366F1] transition-all duration-150"
            style={{ width: `${Math.max(6, audioLevel * 100)}%` }}
          />
        </div>
      </div>
      {error ? (
        <span role="status" className="text-xs text-rose-300">
          {error}
        </span>
      ) : null}
    </div>
  );
}
