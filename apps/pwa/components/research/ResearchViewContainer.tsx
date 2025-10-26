"use client";

import { useCallback, useMemo, type FormEvent } from "react";

import { PlanDrawer } from "@/components/agent/PlanDrawer";
import { useResearchRun } from "@/lib/hooks/useResearchRun";
import { useUIState, type JurisdictionCode } from "@/lib/state/ui-store";

import { EvidenceSidebar } from "./EvidenceSidebar";
import { ResearchControls, ResearchSkeleton, ResearchViewPanel } from "./ResearchViewPanel";

export function ResearchViewContainer() {
  const setPlanDrawerOpen = useUIState((state) => state.setPlanDrawerOpen);
  const jurisdiction = useUIState((state) => state.jurisdiction);
  const setJurisdiction = useUIState((state) => state.setJurisdiction);

  const normalizedJurisdiction = jurisdiction === "Automatique" ? null : jurisdiction;

  const {
    context,
    isLoading,
    plan,
    citations,
    messages,
    toolLogs,
    activeTools,
    composer,
    setComposer,
    confidentialMode,
    setConfidentialMode,
    webSearchMode,
    setWebSearchMode,
    fileSearchEnabled,
    setFileSearchEnabled,
    activeDateFilter,
    setActiveDateFilter,
    activeVersionFilter,
    setActiveVersionFilter,
    isStreaming,
    submit,
    emitCitationClick,
    suggestions,
    transcriptDisabled
  } = useResearchRun({
    jurisdiction: normalizedJurisdiction,
    onRunStart: () => setPlanDrawerOpen(true)
  });

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit();
    },
    [submit]
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      setComposer(suggestion);
    },
    [setComposer]
  );

  const planForDrawer = useMemo(() => {
    if (!plan) return null;
    return {
      ...plan,
      steps: plan.steps.map((step) => ({ ...step }))
    };
  }, [plan]);

  if (isLoading || !context || !plan || !planForDrawer) {
    return <ResearchSkeleton />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_280px]">
      <ResearchControls
        jurisdiction={jurisdiction as JurisdictionCode}
        onJurisdictionChange={setJurisdiction}
        suggestions={context.suggestions}
        confidentialMode={confidentialMode}
        onConfidentialModeChange={setConfidentialMode}
        webSearchMode={webSearchMode}
        onWebSearchModeChange={setWebSearchMode}
        fileSearchEnabled={fileSearchEnabled}
        onFileSearchChange={setFileSearchEnabled}
        activeDateFilter={activeDateFilter}
        onDateFilterChange={setActiveDateFilter}
        activeVersionFilter={activeVersionFilter}
        onVersionFilterChange={setActiveVersionFilter}
        filters={context.filters}
        quickActionsDisabled={transcriptDisabled}
      />

      <ResearchViewPanel
        plan={plan}
        messages={messages}
        activeTools={activeTools}
        composer={composer}
        isStreaming={isStreaming}
        suggestions={suggestions}
        confidentialMode={confidentialMode}
        onComposerChange={setComposer}
        onComposerSubmit={handleSubmit}
        onSuggestionSelect={handleSuggestionSelect}
      />

      <EvidenceSidebar citations={citations} onCitationClick={emitCitationClick} />

      <PlanDrawer plan={planForDrawer} toolLogs={toolLogs} />
    </div>
  );
}
