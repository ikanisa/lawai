import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  startResearchRun,
  type ResearchPlan,
  type ResearchPlanStep,
  type ResearchStreamEvent,
  type ResearchCitation,
  type WebSearchMode
} from "@/lib/data/research";
import { researchDeskContextQueryOptions } from "@/lib/queries/research";
import { useTelemetry } from "@/lib/telemetry";
import type { ChatMessage, ToolLogEntry } from "@/lib/research/types";

interface UseResearchRunOptions {
  jurisdiction: string | null;
  onRunStart?: () => void;
}

interface SubmitResult {
  submitted: boolean;
  assistantMessageId?: string;
}

export function useResearchRun({ jurisdiction, onRunStart }: UseResearchRunOptions) {
  const telemetry = useTelemetry();
  const { data, isLoading } = useQuery(researchDeskContextQueryOptions());

  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [citations, setCitations] = useState<ResearchCitation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      content:
        "Bonjour, je suis votre desk de recherche. Décrivez la problématique juridique et je construirai un plan IRAC avec les sources officielles pertinentes.",
      citations: [],
      createdAt: Date.now()
    }
  ]);
  const [toolLogs, setToolLogs] = useState<ToolLogEntry[]>([]);
  const [activeToolIds, setActiveToolIds] = useState<string[]>([]);
  const [composer, setComposer] = useState("");
  const [confidentialMode, setConfidentialMode] = useState(false);
  const [webSearchMode, setWebSearchMode] = useState<WebSearchMode>("allowlist");
  const [fileSearchEnabled, setFileSearchEnabled] = useState(true);
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null);
  const [activeVersionFilter, setActiveVersionFilter] = useState<string | null>("current");
  const [isStreaming, setIsStreaming] = useState(false);

  const streamingMessageIdRef = useRef<string | null>(null);
  const webSearchModeHistoryRef = useRef<WebSearchMode>("allowlist");
  const forcedWebSearchDisableRef = useRef(false);
  const cleanupRef = useRef<() => void>();

  useEffect(() => {
    if (!isLoading && data) {
      setPlan({
        ...data.plan,
        steps: data.plan.steps.map((step) => ({ ...step }))
      });
      setCitations(data.defaultCitations);
    }
  }, [data, isLoading]);

  useEffect(() => {
    if (!citations.length) return;
    const highConfidence = citations.filter((citation) => citation.score >= 75).length;
    const stale = citations.filter((citation) => {
      const ageMs = Date.now() - new Date(citation.date).getTime();
      const years = ageMs / (1000 * 60 * 60 * 24 * 365);
      return years > 5;
    }).length;
    telemetry.emit("citations_ready", { total: citations.length, highConfidence, stale });
  }, [citations, telemetry]);

  useEffect(() => {
    if (!plan) return;
    const expected = plan.steps.length;
    if (!expected) return;
    const retrieved = plan.steps.filter((step) => step.status === "done").length;
    telemetry.emit("retrieval_recall_scored", { expected, retrieved });
  }, [plan, telemetry]);

  useEffect(() => {
    if (webSearchMode !== "disabled") {
      webSearchModeHistoryRef.current = webSearchMode;
    }
  }, [webSearchMode]);

  useEffect(() => {
    if (confidentialMode) {
      forcedWebSearchDisableRef.current = true;
      setWebSearchMode("disabled");
    } else if (forcedWebSearchDisableRef.current) {
      forcedWebSearchDisableRef.current = false;
      setWebSearchMode(webSearchModeHistoryRef.current);
    }
  }, [confidentialMode]);

  const suggestions = data?.suggestions ?? [];

  const emitCitationClick = useCallback(
    (citation: ResearchCitation) => {
      telemetry.emit("citation_clicked", { citationId: citation.id, context: "chat" });
    },
    [telemetry]
  );

  const handleStreamEvent = useCallback((event: ResearchStreamEvent, assistantId: string) => {
    if (event.type === "token" && event.data.token) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, content: `${message.content}${event.data.token}` }
            : message
        )
      );
    }

    if (event.type === "citation" && event.data.citation) {
      const citation = event.data.citation;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId && !message.citations.some((c) => c.id === citation.id)
            ? { ...message, citations: [...message.citations, citation] }
            : message
        )
      );
      setCitations((prev) => {
        if (prev.some((item) => item.id === citation.id)) return prev;
        return [citation, ...prev];
      });
    }

    if (event.type === "risk" && event.data.risk) {
      const risk = event.data.risk;
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              riskLevel: risk.level,
              riskSummary: risk.summary
            }
          : prev
      );
    }

    if (event.type === "tool" && event.data.tool) {
      const tool = event.data.tool;
      setActiveToolIds((prev) => {
        if (tool.status === "success" || tool.status === "error") {
          return prev.filter((id) => id !== tool.id);
        }
        if (prev.includes(tool.id)) return prev;
        return [...prev, tool.id];
      });

      setToolLogs((prev) => {
        const existing = prev.find((item) => item.id === tool.id);
        if (existing) {
          return prev.map((item) =>
            item.id === tool.id
              ? { ...item, status: tool.status, detail: tool.detail }
              : item
          );
        }
        const startedAt = new Intl.DateTimeFormat("fr-FR", {
          hour: "2-digit",
          minute: "2-digit"
        }).format(new Date());
        return [
          ...prev,
          {
            id: tool.id,
            name: tool.name,
            status: tool.status,
            detail: tool.detail,
            startedAt
          }
        ];
      });

      setPlan((prev) => updatePlanSteps(prev, tool.planStepId ?? undefined, tool.status, tool.detail));
    }

    if (event.type === "done") {
      setIsStreaming(false);
      streamingMessageIdRef.current = null;
    }
  }, []);

  const submit = useCallback(
    (overrideJurisdiction?: string | null): SubmitResult => {
      const input = composer.trim();
      if (!input) {
        return { submitted: false };
      }

      setComposer("");

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: input,
        citations: [],
        createdAt: Date.now()
      };
      setMessages((prev) => [...prev, userMessage]);
      telemetry.emit("run_submitted", { agentId: "research", inputLength: input.length });
      onRunStart?.();
      setIsStreaming(true);

      const assistantMessageId = `assistant-${Date.now()}`;
      streamingMessageIdRef.current = assistantMessageId;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          citations: [],
          createdAt: Date.now()
        }
      ]);

      cleanupRef.current?.();
      const effectiveWebSearchMode: WebSearchMode = confidentialMode ? "disabled" : webSearchMode;
      const toolsEnabled = [
        "lookupCodeArticle",
        ...(effectiveWebSearchMode !== "disabled" ? ["web_search"] : []),
        ...(fileSearchEnabled ? ["file_search"] : []),
        "limitationCheck"
      ];

      const policyFlags = confidentialMode ? ["confidential_mode"] : [];

      const normalizedJurisdiction = overrideJurisdiction ?? jurisdiction ?? null;

      cleanupRef.current = startResearchRun(
        input,
        (event) => {
          handleStreamEvent(event, assistantMessageId);
        },
        {
          agentId: "research",
          toolsEnabled,
          jurisdiction: normalizedJurisdiction,
          policyFlags,
          webSearchMode: effectiveWebSearchMode
        }
      );

      return { submitted: true, assistantMessageId };
    },
    [
      composer,
      confidentialMode,
      fileSearchEnabled,
      handleStreamEvent,
      jurisdiction,
      onRunStart,
      telemetry,
      webSearchMode
    ]
  );

  useEffect(() => () => cleanupRef.current?.(), []);

  const activeTools = useMemo(() => {
    return toolLogs.filter((tool) => activeToolIds.includes(tool.id));
  }, [toolLogs, activeToolIds]);

  const effectiveWebSearchDisabled = (confidentialMode ? "disabled" : webSearchMode) === "disabled";
  const transcriptDisabled = confidentialMode && !fileSearchEnabled && effectiveWebSearchDisabled;

  return {
    context: data ?? null,
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
    transcriptDisabled,
    effectiveWebSearchDisabled
  };
}

function updatePlanSteps(
  plan: ResearchPlan | null,
  planStepId: string | undefined,
  status: ToolLogEntry["status"],
  detail: string
): ResearchPlan | null {
  if (!plan || !planStepId) return plan;
  const targetIndex = plan.steps.findIndex((step) => step.id === planStepId);
  if (targetIndex === -1) return plan;
  const steps: ResearchPlanStep[] = plan.steps.map((step, index) => {
    if (index !== targetIndex) return { ...step };
    return {
      ...step,
      status: status === "success" ? "done" : "active",
      summary: detail || step.summary
    };
  });

  if (status === "success") {
    const nextIndex = steps.findIndex((step, index) => index > targetIndex && step.status === "pending");
    if (nextIndex !== -1) {
      steps[nextIndex] = { ...steps[nextIndex], status: "active" };
    }
  }

  return {
    ...plan,
    steps
  };
}
