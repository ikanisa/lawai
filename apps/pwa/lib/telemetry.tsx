"use client";

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";

type TelemetryEventMap = {
  run_submitted: { agentId: string; inputLength: number };
  citation_clicked: { citationId: string; context: "chat" | "matter" | "citation_browser" };
  deadline_computed: { jurisdiction: string; daysUntilDue: number };
  hitl_submitted: { reviewId: string; outcome: "approved" | "changes_requested" | "rejected"; latencyMs: number };
  allowlist_toggled: { sourceId: string; enabled: boolean };
  voice_started: { agentId: string; locale: string };
  voice_stopped: { agentId: string; durationMs: number };
  offline_retry: { entity: string; attempt: number };
  document_exported: { format: "pdf" | "docx"; matterId?: string; c2paSigned: boolean };
  clause_decision: { clauseId: string; action: "accepted" | "rejected"; rationale: string };
  service_plan_generated: { method: string; jurisdiction: string; deadlineHours: number };
  ics_generated: { jurisdiction: string; eventCount: number };
  citations_ready: { total: number; highConfidence: number; stale: number };
  temporal_validity_checked: { total: number; upToDate: number };
  retrieval_recall_scored: { expected: number; retrieved: number };
  hitl_latency_measured: { reviewId: string; latencyMs: number };
  voice_latency_measured: { runId: string; latencyMs: number };
};

type TelemetryEventName = keyof TelemetryEventMap;

type TelemetryBus = {
  emit: <TEvent extends TelemetryEventName>(event: TEvent, payload: TelemetryEventMap[TEvent]) => void;
  on: <TEvent extends TelemetryEventName>(
    event: TEvent,
    handler: (payload: TelemetryEventMap[TEvent]) => void
  ) => () => void;
};

function createTelemetryBus(): TelemetryBus {
  const target = new EventTarget();

  return {
    emit(event, payload) {
      target.dispatchEvent(new CustomEvent(event, { detail: payload }));
    },
    on(event, handler) {
      const listener = (nativeEvent: Event) => handler((nativeEvent as CustomEvent).detail);
      target.addEventListener(event, listener as EventListener);
      return () => target.removeEventListener(event, listener as EventListener);
    }
  };
}

const TelemetryContext = createContext<TelemetryBus | null>(null);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const busRef = useRef<TelemetryBus>();
  if (!busRef.current) {
    busRef.current = createTelemetryBus();
  }

  const value = useMemo(() => busRef.current!, []);
  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error("useTelemetry must be used within a TelemetryProvider");
  }
  return context;
}
