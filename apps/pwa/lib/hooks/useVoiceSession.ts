import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { VoiceRunRequest, VoiceRunResponse } from "@avocat-ai/shared";

import { voiceConsoleContextQueryOptions, submitVoiceRun } from "@/lib/queries/voice";
import { VoiceClient } from "@/lib/voiceClient";
import { useTelemetry } from "@/lib/telemetry";
import { useOutbox, type OutboxItem } from "@/lib/offline/outbox";

export type VoiceStatus = "idle" | "connecting" | "recording" | "processing" | "playback";

export interface VoiceHistoryEntry {
  id: string;
  transcript: string;
  createdAt: string;
  durationMs: number;
  status: "queued" | "processing" | "completed" | "failed";
  outboxId?: string;
  response?: VoiceRunResponse;
  error?: string;
}

interface NotificationPayload {
  title: string;
  description: string;
  variant?: "default" | "destructive";
}

interface UseVoiceSessionOptions {
  locale: string;
  notify?: (notification: NotificationPayload) => void;
}

export function useVoiceSession({ locale, notify }: UseVoiceSessionOptions) {
  const telemetry = useTelemetry();
  const { data, isLoading } = useQuery(voiceConsoleContextQueryOptions());

  const {
    items: outboxItems,
    enqueue,
    markComplete,
    markFailed,
    markSyncing,
    isOnline,
    stalenessMs
  } = useOutbox();

  const voiceOutbox = useMemo(
    () => outboxItems.filter((item): item is OutboxItem<VoiceRunRequest> => item.channel === "voice"),
    [outboxItems]
  );

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [captions, setCaptions] = useState("");
  const [history, setHistory] = useState<VoiceHistoryEntry[]>([]);
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null);

  const voiceClientRef = useRef<VoiceClient>();
  const transcriptRef = useRef<string>("");
  const sessionStartRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);
  const playbackTimeoutRef = useRef<number | null>(null);

  const suggestionSegments = useMemo(() => {
    if (!data?.suggestions?.length) {
      return [
        "Confirme la compétence OHADA avant de lancer la mesure",
        "Prépare la signification CCJA et vérifie les délais",
        "Ajoute les citations officielles à la note vocale"
      ];
    }
    return data.suggestions
      .map((entry) => entry.split(",").join(" ").split(".").join(" "))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }, [data?.suggestions]);

  const ensureClient = useCallback(() => {
    if (!voiceClientRef.current) {
      voiceClientRef.current = new VoiceClient({
        onTranscript: (chunk) => {
          transcriptRef.current = transcriptRef.current ? `${transcriptRef.current} ${chunk}` : chunk;
          setCaptions(transcriptRef.current);
        },
        onStateChange: (next) => {
          if (next === "idle" && status !== "processing") {
            setStatus("idle");
          } else if (next === "recording") {
            setStatus("recording");
          }
        },
        onAudioLevel: setAudioLevel
      });
    }
    return voiceClientRef.current;
  }, [status]);

  const stopSimulation = useCallback(() => {
    if (simulationIntervalRef.current) {
      window.clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  }, []);

  const beginSimulation = useCallback(
    (client: VoiceClient) => {
      stopSimulation();
      let index = 0;
      simulationIntervalRef.current = window.setInterval(() => {
        const segment = suggestionSegments[index % suggestionSegments.length] ?? suggestionSegments[0];
        client.emitTranscript(segment);
        index += 1;
      }, 1500);
    },
    [suggestionSegments, stopSimulation]
  );

  const resetSession = useCallback(() => {
    transcriptRef.current = "";
    setCaptions("");
    sessionStartRef.current = null;
    stopSimulation();
  }, [stopSimulation]);

  const finalizePlayback = useCallback(() => {
    if (playbackTimeoutRef.current) {
      window.clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    setStatus("idle");
    setActiveResponseId(null);
  }, []);

  const beginPlayback = useCallback(
    (entryId: string) => {
      setStatus("playback");
      setActiveResponseId(entryId);
      if (playbackTimeoutRef.current) {
        window.clearTimeout(playbackTimeoutRef.current);
      }
      playbackTimeoutRef.current = window.setTimeout(() => {
        finalizePlayback();
      }, 4500);
    },
    [finalizePlayback]
  );

  useEffect(
    () => () => {
      stopSimulation();
      finalizePlayback();
      void voiceClientRef.current?.disconnect();
    },
    [finalizePlayback, stopSimulation]
  );

  const handleVoiceSubmission = useCallback(
    async (transcript: string, durationMs: number, existingOutboxId?: string) => {
      const entryId = existingOutboxId ?? `voice_${Date.now()}`;
      setHistory((prev) => [
        {
          id: entryId,
          transcript,
          createdAt: new Date().toISOString(),
          durationMs,
          status: isOnline ? "processing" : "queued",
          outboxId: existingOutboxId
        },
        ...prev
      ]);

      const request: VoiceRunRequest = {
        agent_id: "voice_concierge",
        locale,
        transcript,
        intents: [],
        citations: []
      };

      if (!isOnline) {
        const item = enqueue({ channel: "voice", payload: request });
        setHistory((prev) =>
          prev.map((entry) =>
            entry.id === entryId
              ? { ...entry, outboxId: item.id, status: "queued" }
              : entry
          )
        );
        telemetry.emit("voice_stopped", { agentId: "voice_concierge", durationMs });
        telemetry.emit("voice_latency_measured", { runId: entryId, latencyMs: durationMs });
        notify?.({
          title: "Hors ligne — réponse en attente",
          description: "La demande est placée dans l’outbox et sera rejouée automatiquement."
        });
        setStatus("idle");
        return;
      }

      setStatus("processing");
      try {
        const response = await submitVoiceRun(request);
        telemetry.emit("voice_stopped", { agentId: "voice_concierge", durationMs });
        telemetry.emit("voice_latency_measured", { runId: entryId, latencyMs: durationMs });
        setHistory((prev) =>
          prev.map((entry) =>
            entry.id === entryId
              ? { ...entry, response, status: "completed" }
              : entry
          )
        );
        beginPlayback(entryId);
      } catch (error) {
        setHistory((prev) =>
          prev.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  status: "failed",
                  error: error instanceof Error ? error.message : "unknown_error"
                }
              : entry
          )
        );
        telemetry.emit("offline_retry", { entity: entryId, attempt: 1 });
        notify?.({
          title: "Échec du traitement",
          description: "Impossible d’obtenir une réponse vocale. Réessayez ou basculez en texte.",
          variant: "destructive"
        });
        setStatus("idle");
      }
    },
    [beginPlayback, enqueue, isOnline, locale, notify, telemetry]
  );

  const toggleRecording = useCallback(async () => {
    if (status === "connecting" || status === "processing") {
      return;
    }

    const client = ensureClient();
    if (status === "recording") {
      stopSimulation();
      await client.disconnect();
      const duration = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0;
      const transcript = transcriptRef.current.trim();
      resetSession();
      if (!transcript) {
        setStatus("idle");
        return;
      }
      await handleVoiceSubmission(transcript, duration);
      return;
    }

    setStatus("connecting");
    transcriptRef.current = "";
    setCaptions("");
    try {
      await client.connect();
      telemetry.emit("voice_started", { agentId: "voice_concierge", locale });
      sessionStartRef.current = Date.now();
      beginSimulation(client);
    } catch (error) {
      notify?.({
        title: "Connexion vocale indisponible",
        description: "Impossible d’initier la session Realtime pour le moment.",
        variant: "destructive"
      });
      setStatus("idle");
      resetSession();
    }
  }, [
    beginSimulation,
    ensureClient,
    handleVoiceSubmission,
    locale,
    notify,
    resetSession,
    status,
    stopSimulation,
    telemetry
  ]);

  const handleOutboxRetry = useCallback(
    async (item: OutboxItem<VoiceRunRequest>) => {
      markSyncing(item.id);
      try {
        const response = await submitVoiceRun(item.payload);
        markComplete(item.id);
        telemetry.emit("voice_stopped", { agentId: item.payload.agent_id, durationMs: 0 });
        telemetry.emit("voice_latency_measured", { runId: item.id, latencyMs: 0 });
        let playbackId = item.id;
        setHistory((prev) => {
          const existing = prev.find((entry) => entry.outboxId === item.id);
          if (existing) {
            playbackId = existing.id;
            return prev.map((entry) =>
              entry.outboxId === item.id
                ? {
                    ...entry,
                    response,
                    status: "completed",
                    error: undefined
                  }
                : entry
            );
          }
          const generatedId = `voice_${Date.now()}`;
          playbackId = generatedId;
          return [
            {
              id: generatedId,
              transcript: item.payload.transcript,
              createdAt: new Date().toISOString(),
              durationMs: 0,
              status: "completed",
              response
            },
            ...prev
          ];
        });
        beginPlayback(playbackId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "retry_failed";
        markFailed(item.id, message);
        telemetry.emit("offline_retry", { entity: item.id, attempt: item.attempts + 1 });
        notify?.({
          title: "Relance impossible",
          description: "La synchronisation vocale a échoué. Réessayez plus tard.",
          variant: "destructive"
        });
      }
    },
    [beginPlayback, markComplete, markFailed, markSyncing, notify, telemetry]
  );

  useEffect(() => {
    if (!isOnline || !voiceOutbox.length) {
      return;
    }
    voiceOutbox
      .filter((item) => item.status === "queued")
      .forEach((item) => {
        void handleOutboxRetry(item);
      });
  }, [handleOutboxRetry, isOnline, voiceOutbox]);

  const latestEntry = history[0];
  const activeResponse = history.find((entry) => entry.id === activeResponseId)?.response ?? latestEntry?.response;
  const quickIntents = data?.quickIntents ?? [];
  const bargeInAvailable = status === "playback";

  const handleClarification = useCallback(
    async (prompt: string) => {
      await handleVoiceSubmission(prompt, 0);
    },
    [handleVoiceSubmission]
  );

  return {
    context: data ?? null,
    isLoading,
    status,
    audioLevel,
    captions,
    history,
    activeResponse,
    voiceOutbox,
    isOnline,
    stalenessMs,
    quickIntents,
    bargeInAvailable,
    toggleRecording,
    finalizePlayback,
    handleOutboxRetry,
    handleClarification,
    setActiveResponseId,
    activeResponseId
  };
}
