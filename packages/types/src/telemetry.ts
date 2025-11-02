export interface TelemetryEventMap {
  run_submitted: Record<string, unknown>;
  run_completed: Record<string, unknown>;
  run_failed: Record<string, unknown>;
  citation_clicked: Record<string, unknown>;
  citation_verify: Record<string, unknown>;
  allowlist_toggled: Record<string, unknown>;
  allowlist_toggle_failed: Record<string, unknown>;
  command_palette_button: undefined;
  command_palette_opened: undefined;
  command_palette_action: { actionId: string };
  confidential_mode_toggled: { enabled: boolean };
  pwa_prompt_shown: { pendingOutbox: number; digestEnabled?: boolean; releaseNotes?: number };
  pwa_install_attempt: { pendingOutbox: number };
  pwa_install_accepted: undefined;
  pwa_install_snoozed: undefined;
  pwa_install_unavailable: undefined;
  pwa_install_dismissed: undefined;
  pwa_digest_opt_in: { pendingOutbox: number };
  voice_dictation_used: undefined;
  camera_ocr_added: undefined;
  rwanda_language_toggle: { language: string };
  reading_mode_changed: { mode: string };
  outbox_enqueued: { offline: boolean };
  outbox_retry: { success: boolean; runId?: string; message?: string };
  outbox_auto_flush: { success: boolean; runId?: string; message?: string };
  bilingual_toggle: { language: string; jurisdiction?: string | null };
  hitl_requested: Record<string, unknown>;
  corpus_resummarize: { documentId: string; status: unknown };
  corpus_resummarize_failed: { documentId: string; message?: string };
  deadline_computed: { jurisdiction: string; daysUntilDue: number };
  hitl_submitted: { reviewId: string; outcome: string; latencyMs: number };
  voice_started: { agentId: string; locale: string };
  voice_stopped: { agentId: string; durationMs: number };
  offline_retry: { entity: string; attempt: number };
  document_exported: { format: string; matterId?: string; c2paSigned: boolean };
  clause_decision: { clauseId: string; action: string; rationale: string };
  service_plan_generated: { method: string; jurisdiction: string; deadlineHours: number };
  ics_generated: { jurisdiction: string; eventCount: number };
  citations_ready: { total: number; highConfidence: number; stale: number };
  temporal_validity_checked: { total: number; upToDate: number };
  retrieval_recall_scored: { expected: number; retrieved: number };
  hitl_latency_measured: { reviewId: string; latencyMs: number };
  voice_latency_measured: { runId: string; latencyMs: number };
}

export type TelemetryEventName = keyof TelemetryEventMap;

export type TelemetryEventPayload<TEvent extends TelemetryEventName> = TelemetryEventMap[TEvent];
