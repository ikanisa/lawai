"use client";

import { useMemo } from "react";

import { useToast } from "@/components/ui/use-toast";
import { useLocale } from "@/lib/i18n/provider";
import { useVoiceSession } from "@/lib/hooks/useVoiceSession";

import { VoiceConsolePanel } from "./VoiceConsolePanel";

export function VoiceConsoleContainer() {
  const { locale, formatDateTime } = useLocale();
  const { toast } = useToast();
  const session = useVoiceSession({ locale, notify: toast });

  const guardrails = useMemo(() => session.context?.guardrails ?? [], [session.context?.guardrails]);
  const suggestions = useMemo(() => session.context?.suggestions ?? [], [session.context?.suggestions]);

  return (
    <VoiceConsolePanel
      status={session.status}
      audioLevel={session.audioLevel}
      captions={session.captions}
      quickIntents={session.quickIntents}
      suggestions={suggestions}
      guardrails={guardrails}
      onToggleRecording={session.toggleRecording}
      bargeInAvailable={session.bargeInAvailable}
      onBargeIn={session.finalizePlayback}
      history={session.history}
      isLoading={session.isLoading}
      formatDateTime={formatDateTime}
      isOnline={session.isOnline}
      voiceOutbox={session.voiceOutbox}
      stalenessMs={session.stalenessMs}
      onRetryOutbox={session.handleOutboxRetry}
      activeResponse={session.activeResponse}
      onClarification={session.handleClarification}
    />
  );
}
