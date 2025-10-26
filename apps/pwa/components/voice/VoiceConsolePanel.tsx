"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mic,
  Play,
  Square,
  Volume2
} from "lucide-react";
import type { VoiceRunResponse, VoiceToolIntent, VoiceRunRequest } from "@avocat-ai/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OutboxStatusChip } from "@/components/pwa/OutboxStatusChip";
import { cn } from "@/lib/utils";
import type { OutboxItem } from "@/lib/offline/outbox";

import type { VoiceHistoryEntry, VoiceStatus } from "@/lib/hooks/useVoiceSession";

const defaultSegments = [
  "Confirme la compétence OHADA avant de lancer la mesure",
  "Prépare la signification CCJA et vérifie les délais",
  "Ajoute les citations officielles à la note vocale"
];

interface VoiceConsolePanelProps {
  status: VoiceStatus;
  audioLevel: number;
  captions: string;
  quickIntents: Array<{ id: string; name: string }>;
  suggestions: string[];
  guardrails: string[];
  onToggleRecording: () => void | Promise<void>;
  bargeInAvailable: boolean;
  onBargeIn: () => void;
  history: VoiceHistoryEntry[];
  isLoading: boolean;
  formatDateTime: (value: string) => string;
  isOnline: boolean;
  voiceOutbox: OutboxItem<VoiceRunRequest>[];
  stalenessMs: number;
  onRetryOutbox: (item: OutboxItem<VoiceRunRequest>) => void;
  activeResponse?: VoiceRunResponse;
  onClarification: (prompt: string) => void | Promise<void>;
}

export function VoiceConsolePanel({
  status,
  audioLevel,
  captions,
  quickIntents,
  suggestions,
  guardrails,
  onToggleRecording,
  bargeInAvailable,
  onBargeIn,
  history,
  isLoading,
  formatDateTime,
  isOnline,
  voiceOutbox,
  stalenessMs,
  onRetryOutbox,
  activeResponse,
  onClarification
}: VoiceConsolePanelProps) {
  const retryAll = () => {
    voiceOutbox.forEach((item) => onRetryOutbox(item));
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[var(--shadow-z2)] backdrop-blur">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Console vocale</h1>
            <p className="mt-1 text-sm text-white/70">
              Push-to-talk, captations en direct et lecture des citations. Les guardrails actifs sont rappelés ci-dessous.
            </p>
          </div>
          <OutboxStatusChip
            queued={voiceOutbox.length}
            stalenessMs={stalenessMs}
            isOnline={isOnline}
            onRetry={voiceOutbox.length && isOnline ? retryAll : undefined}
          />
        </header>
        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <RecordingControls
            status={status}
            audioLevel={audioLevel}
            captions={captions}
            onToggleRecording={onToggleRecording}
            bargeInAvailable={bargeInAvailable}
            onBargeIn={onBargeIn}
            quickIntents={quickIntents}
          />
          <TelemetryWidgets guardrails={guardrails} suggestions={suggestions} onClarification={onClarification} />
        </div>
      </section>

      <TranscriptHistory
        history={history}
        isLoading={isLoading}
        formatDateTime={formatDateTime}
        isOnline={isOnline}
        voiceOutbox={voiceOutbox}
        onRetryOutbox={onRetryOutbox}
      />

      {activeResponse ? (
        <PlaybackDetails response={activeResponse} onClarification={onClarification} />
      ) : null}
    </div>
  );
}

function RecordingControls({
  status,
  audioLevel,
  captions,
  onToggleRecording,
  bargeInAvailable,
  onBargeIn,
  quickIntents
}: {
  status: VoiceStatus;
  audioLevel: number;
  captions: string;
  onToggleRecording: () => void | Promise<void>;
  bargeInAvailable: boolean;
  onBargeIn: () => void;
  quickIntents: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="flex-1 space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/10 p-6 shadow-[var(--shadow-z2)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-white/60">Session</p>
            <p className="text-lg font-semibold text-white">
              {status === "recording"
                ? "Enregistrement"
                : status === "processing"
                  ? "Analyse"
                  : status === "playback"
                    ? "Lecture"
                    : "Prêt"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full border border-white/20 bg-black/30 shadow-inner">
              <div
                className="h-full w-full rounded-full bg-gradient-to-br from-[#22D3EE]/30 to-[#6366F1]/40"
                style={{ transform: `scale(${0.65 + audioLevel * 0.35})` }}
              />
            </div>
            <div className="text-right text-xs text-white/60">
              <p>Niveau micro</p>
              <p className="font-semibold text-white">{Math.round(audioLevel * 100)}%</p>
            </div>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => void onToggleRecording()}
          variant="glass"
          className={cn(
            "group relative flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-base font-semibold text-white transition",
            status === "recording"
              ? "bg-rose-500/80 hover:bg-rose-500"
              : "bg-gradient-to-r from-[#22D3EE] to-[#6366F1] text-[#0B1220] hover:shadow-[0_20px_45px_rgba(99,102,241,0.35)]"
          )}
          disabled={status === "processing"}
        >
          {status === "recording" ? (
            <Square className="h-5 w-5" aria-hidden />
          ) : status === "processing" ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <Mic className="h-5 w-5" aria-hidden />
          )}
          {status === "recording"
            ? "Stop"
            : status === "processing"
              ? "Analyse en cours"
              : "Push-to-talk"}
        </Button>
        {bargeInAvailable ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/10 text-sm text-white/80 hover:text-white"
            onClick={onBargeIn}
          >
            Interrompre la lecture (barge-in)
          </Button>
        ) : null}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Captions en direct</p>
          <p className="mt-2 min-h-[80px] text-sm text-white/80">{captions || "En attente de dictée…"}</p>
        </div>
      </div>
      <div className="rounded-3xl border border-white/12 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">Raccourcis outils</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {quickIntents.map((intent) => (
            <Badge key={intent.id} variant="outline" className="bg-white/5 text-xs text-white/80">
              {intent.name}
            </Badge>
          ))}
          {!quickIntents.length ? <p className="text-sm text-white/60">Chargement des outils…</p> : null}
        </div>
      </div>
    </div>
  );
}

function TelemetryWidgets({
  guardrails,
  suggestions,
  onClarification
}: {
  guardrails: string[];
  suggestions: string[];
  onClarification: (prompt: string) => void | Promise<void>;
}) {
  return (
    <div className="w-full max-w-md space-y-4">
      <div className="rounded-3xl border border-white/12 bg-black/40 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">Guardrails actifs</p>
        <ul className="mt-3 space-y-2 text-sm text-white/70">
          {(guardrails.length ? guardrails : [
            "france_judge_analytics_block actif — aucune analyse prédictive sur les magistrats.",
            "Confidential_mode coupe la recherche web durant les sessions vocales."
          ]).map((item) => (
            <li key={item} className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-sky-300" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-3xl border border-white/12 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">Suggestions</p>
        <div className="mt-3 space-y-2">
          {(suggestions.length ? suggestions : defaultSegments).map((suggestion) => (
            <Button
              key={suggestion}
              variant="ghost"
              className="w-full justify-start rounded-2xl border border-white/10 bg-white/5 text-left text-sm text-white/80 hover:text-white"
              onClick={() => void onClarification(suggestion)}
            >
              <Play className="mr-2 h-4 w-4" aria-hidden />
              {suggestion}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TranscriptHistory({
  history,
  isLoading,
  formatDateTime,
  isOnline,
  voiceOutbox,
  onRetryOutbox
}: {
  history: VoiceHistoryEntry[];
  isLoading: boolean;
  formatDateTime: (value: string) => string;
  isOnline: boolean;
  voiceOutbox: OutboxItem<VoiceRunRequest>[];
  onRetryOutbox: (item: OutboxItem<VoiceRunRequest>) => void;
}) {
  return (
    <section className="rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[var(--shadow-z2)] backdrop-blur">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Historique des sessions</h2>
        <span className="text-xs text-white/60">{history.length} session(s)</span>
      </header>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AnimatePresence>
          {history.map((entry) => (
            <motion.article
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/30 p-4",
                entry.status === "queued" && "border-amber-300/40",
                entry.status === "failed" && "border-rose-400/40"
              )}
            >
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>{formatDateTime(entry.createdAt)}</span>
                <span>{formatDuration(entry.durationMs)}</span>
              </div>
              <p className="text-sm text-white/80">{entry.transcript}</p>
              <div className="flex items-center gap-2 text-xs">
                {entry.status === "completed" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-1 text-emerald-100">
                    <CheckCircle2 className="h-3 w-3" aria-hidden /> Réponse livrée
                  </span>
                ) : entry.status === "processing" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-1 text-sky-100">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Analyse
                  </span>
                ) : entry.status === "queued" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-1 text-amber-100">
                    <AlertCircle className="h-3 w-3" aria-hidden /> En attente hors ligne
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-1 text-rose-100">
                    <AlertCircle className="h-3 w-3" aria-hidden /> Échec
                  </span>
                )}
                {entry.outboxId && (entry.status === "queued" || entry.status === "failed") ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 rounded-full border border-white/10 bg-white/10 text-xs text-white"
                    disabled={!isOnline}
                    onClick={() => {
                      const match = voiceOutbox.find((item) => item.id === entry.outboxId);
                      if (match) {
                        onRetryOutbox(match);
                      }
                    }}
                  >
                    Relancer
                  </Button>
                ) : null}
              </div>
              {entry.response ? <ResponseDetails response={entry.response} intents={entry.response.intents} /> : null}
              {entry.error ? <p className="text-xs text-rose-200">{entry.error}</p> : null}
            </motion.article>
          ))}
        </AnimatePresence>
        {isLoading && !history.length ? (
          <div className="col-span-2 space-y-4">
            <Skeleton className="h-32 w-full rounded-3xl bg-white/10" />
            <Skeleton className="h-32 w-full rounded-3xl bg-white/10" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PlaybackDetails({
  response,
  onClarification
}: {
  response: VoiceRunResponse;
  onClarification: (prompt: string) => void | Promise<void>;
}) {
  return (
    <section className="rounded-3xl border border-white/12 bg-[#0B1220]/80 p-6 shadow-[var(--shadow-z3)]">
      <header className="mb-4 flex items-center gap-3">
        <Volume2 className="h-5 w-5 text-sky-300" aria-hidden />
        <h3 className="text-lg font-semibold text-white">Lecture en cours</h3>
      </header>
      <div className="space-y-4 text-sm text-white/80">
        <p>{response.summary}</p>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">Citations lues</p>
          <ul className="mt-2 space-y-2">
            {response.readback.map((line) => (
              <li key={line} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/80">
                {line}
              </li>
            ))}
          </ul>
        </div>
        {response.followUps.length ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">Clarifications proposées</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {response.followUps.map((followUp) => (
                <Button
                  key={followUp}
                  variant="secondary"
                  className="rounded-full bg-white/10 text-xs text-white"
                  onClick={() => void onClarification(followUp)}
                >
                  {followUp}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ResponseDetails({ response, intents }: { response: VoiceRunResponse; intents: VoiceToolIntent[] }) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-sm text-white/80">{response.summary}</p>
      <div className="space-y-2 text-xs text-white/60">
        <div>
          <p className="font-semibold uppercase tracking-[0.25em] text-white/40">Citations</p>
          <ScrollArea className="mt-1 h-24">
            <ul className="space-y-2 pr-2">
              {response.citations.map((citation) => (
                <li key={citation.id} className="rounded-2xl border border-white/10 bg-black/30 p-2 text-white/70">
                  <p className="text-white/90">{citation.label}</p>
                  <p className="mt-1 text-[11px] text-white/60">{citation.snippet}</p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-[0.25em] text-white/40">Intents déclenchés</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {intents.map((intent) => (
              <Badge
                key={intent.id}
                className={cn(
                  "rounded-full border border-white/10 bg-white/10 text-[11px] text-white/80",
                  intent.status === "requires_hitl" && "border-amber-400/60 text-amber-100"
                )}
              >
                {intent.name} · {intent.status}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDuration(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return `${seconds}s`;
}

