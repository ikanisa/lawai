"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  Filter,
  HelpCircle,
  Mic,
  Paperclip,
  ShieldAlert,
  Sparkles,
  UploadCloud
} from "lucide-react";

import { PlanDrawer, type ToolLogEntry } from "@/components/agent/PlanDrawer";
import { ToolChip } from "@/components/agent/ToolChip";
import { EvidencePane } from "@/components/evidence/EvidencePane";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  type ResearchCitation,
  type ResearchDeskContext,
  type ResearchFilterOption,
  type ResearchPlan,
  type ResearchPlanStep,
  type ResearchStreamEvent,
  startResearchRun
} from "@/lib/data/research";
import { researchDeskContextQueryOptions } from "@/lib/queries/research";
import { useTelemetry } from "@/lib/telemetry";
import { jurisdictionOptions, useUIState, type JurisdictionCode } from "@/lib/state/ui-store";
import { cn } from "@/lib/utils";
import { MessageBubble, type ChatMessage } from "./MessageBubble";

export function ResearchView() {
  const telemetry = useTelemetry();
  const setPlanDrawerOpen = useUIState((state) => state.setPlanDrawerOpen);
  const jurisdiction = useUIState((state) => state.jurisdiction);
  const setJurisdiction = useUIState((state) => state.setJurisdiction);

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
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [fileSearchEnabled, setFileSearchEnabled] = useState(true);
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null);
  const [activeVersionFilter, setActiveVersionFilter] = useState<string | null>("current");
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingMessageIdRef = useRef<string | null>(null);
  const cleanupRef = useRef<() => void>();

  useEffect(() => {
    if (!isLoading && data) {
      setPlan({
        ...data.plan,
        steps: data.plan.steps.map((step: ResearchPlanStep) => ({ ...step }))
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
    const retrieved = plan.steps.filter((step: ResearchPlanStep) => step.status === "done").length;
    telemetry.emit("retrieval_recall_scored", { expected, retrieved });
  }, [plan, telemetry]);

  const suggestions = data?.suggestions ?? [];

  const handleStreamEvent = useCallback((event: ResearchStreamEvent, assistantId: string) => {
    if (event.type === "token" && event.data.token) {
      setMessages((prev) =>
        prev.map((message: ChatMessage) =>
            message.id === assistantId
              ? { ...message, content: `${message.content}${event.data.token}` }
              : message
        )
      );
    }

    if (event.type === "citation" && event.data.citation) {
      const citation = event.data.citation;
      setMessages((prev) =>
        prev.map((message: ChatMessage) =>
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
          return prev.map((item: ToolLogEntry) =>
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

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!composer.trim()) return;
      const input = composer.trim();
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
      setPlanDrawerOpen(true);
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
      const toolsEnabled = [
        "lookupCodeArticle",
        ...(webSearchEnabled && !confidentialMode ? ["web_search"] : []),
        ...(fileSearchEnabled ? ["file_search"] : []),
        "limitationCheck"
      ];

      const policyFlags = confidentialMode ? ["confidential_mode"] : [];

      const normalizedJurisdiction = jurisdiction === "Automatique" ? null : jurisdiction;

      cleanupRef.current = startResearchRun(
        input,
        (event) => {
          handleStreamEvent(event, assistantMessageId);
        },
        {
          agentId: "research",
          toolsEnabled,
          jurisdiction: normalizedJurisdiction,
          policyFlags
        }
      );
    },
    [
      composer,
      handleStreamEvent,
      setPlanDrawerOpen,
      telemetry,
      webSearchEnabled,
      confidentialMode,
      fileSearchEnabled,
      jurisdiction
    ]
  );

  useEffect(() => () => cleanupRef.current?.(), []);

  const activeTools = useMemo(() => {
    return toolLogs.filter((tool) => activeToolIds.includes(tool.id));
  }, [toolLogs, activeToolIds]);

  const transcriptDisabled = confidentialMode && !fileSearchEnabled && !webSearchEnabled;

  if (isLoading || !plan || !data) {
    return <ResearchSkeleton />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_280px]">
      <div className="space-y-4" aria-label="Outils de requête">
        <JurisdictionRouter
          jurisdiction={jurisdiction}
          onChange={setJurisdiction}
          suggestions={suggestions}
        />
        <ToolToggles
          confidentialMode={confidentialMode}
          onConfidentialModeChange={setConfidentialMode}
          webSearchEnabled={webSearchEnabled}
          onWebSearchChange={setWebSearchEnabled}
          fileSearchEnabled={fileSearchEnabled}
          onFileSearchChange={setFileSearchEnabled}
          disabled={confidentialMode}
        />
        <FiltersPanel
          activeDateFilter={activeDateFilter}
          onDateFilterChange={setActiveDateFilter}
          activeVersionFilter={activeVersionFilter}
          onVersionFilterChange={setActiveVersionFilter}
          publicationDates={data.filters.publicationDates}
          entryIntoForce={data.filters.entryIntoForce}
        />
        <QuickActions disabled={transcriptDisabled} />
      </div>

      <section aria-label="Conversation de recherche" className="space-y-4">
        <RiskBanner level={plan.riskLevel} summary={plan.riskSummary} />
        <div className="flex flex-col gap-4 rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[var(--shadow-z2)] backdrop-blur-2xl">
          <div
            className="max-h-[60vh] space-y-4 overflow-y-auto pr-2"
            role="log"
            aria-live="polite"
            aria-label="Flux de réponses de l’agent"
          >
            {messages
              .slice()
              .sort((a, b) => a.createdAt - b.createdAt)
              .map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
          </div>
          {activeTools.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeTools.map((tool) => (
                <ToolChip key={tool.id} name={tool.name} status={tool.status} description={tool.detail} />
              ))}
            </div>
          ) : null}
          <ChatComposer
            value={composer}
            onChange={setComposer}
            onSubmit={handleSubmit}
            disabled={isStreaming}
            suggestions={suggestions}
            onSuggestion={(prompt) => setComposer(prompt)}
            confidentialMode={confidentialMode}
          />
        </div>
      </section>

      <EvidencePane
        citations={citations}
        onCitationClick={(citation) =>
          telemetry.emit("citation_clicked", { citationId: citation.id, context: "chat" })
        }
      />

      <PlanDrawer plan={{ ...plan, steps: plan.steps }} toolLogs={toolLogs} />
    </div>
  );
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
  const steps: ResearchPlanStep[] = plan.steps.map((step: ResearchPlanStep, index) => {
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

function ResearchSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-3xl border border-white/10 bg-white/5" />
        <Skeleton className="h-32 rounded-3xl border border-white/10 bg-white/5" />
        <Skeleton className="h-40 rounded-3xl border border-white/10 bg-white/5" />
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <Skeleton className="mb-4 h-10 rounded-full" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-[480px] rounded-3xl border border-white/10 bg-white/5" />
    </div>
  );
}

function JurisdictionRouter({
  jurisdiction,
  onChange,
  suggestions
}: {
  jurisdiction: JurisdictionCode;
  onChange: (jurisdiction: JurisdictionCode) => void;
  suggestions: string[];
}) {
  return (
    <section className="glass-surface space-y-4 rounded-3xl border border-white/12 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/80">Routage de juridiction</h2>
        <Badge className="rounded-full bg-gradient-to-r from-[#22D3EE] to-[#6366F1] text-[11px]">Auto</Badge>
      </div>
      <div className="space-y-3">
        <label className="flex flex-col text-xs font-medium text-white/60">
          Sélection
          <select
            value={jurisdiction}
            onChange={(event) => onChange(event.target.value as JurisdictionCode)}
            className="mt-1 rounded-2xl border border-white/10 bg-[#0B1220]/70 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#22D3EE]"
          >
            {jurisdictionOptions.map((option: string) => (
              <option key={option} value={option} className="bg-[#0B1220]">
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-3 text-xs text-white/70">
          <p>OHADA et UE activés automatiquement selon la langue de la requête.</p>
        </div>
      </div>
      {suggestions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-white/60">Suggestions</p>
          <ul className="space-y-1 text-xs text-white/70">
            {suggestions.slice(0, 2).map((suggestion: string) => (
              <li key={suggestion} className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 text-sky-200" aria-hidden />
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ToolToggles({
  confidentialMode,
  onConfidentialModeChange,
  webSearchEnabled,
  onWebSearchChange,
  fileSearchEnabled,
  onFileSearchChange,
  disabled
}: {
  confidentialMode: boolean;
  onConfidentialModeChange: (value: boolean) => void;
  webSearchEnabled: boolean;
  onWebSearchChange: (value: boolean) => void;
  fileSearchEnabled: boolean;
  onFileSearchChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <section className="glass-surface space-y-4 rounded-3xl border border-white/12 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/80">Outils</h2>
        <HelpCircle className="h-4 w-4 text-white/50" aria-hidden />
      </div>
      <ToggleRow
        label="Web Search"
        description="Recherche autorisée sur la sélection de domaines conformes."
        checked={webSearchEnabled}
        onChange={(value) => onWebSearchChange(value)}
        disabled={confidentialMode}
      />
      <ToggleRow
        label="File Search"
        description="Recherche dans le corpus autorisé et les actes uniformes."
        checked={fileSearchEnabled}
        onChange={(value) => onFileSearchChange(value)}
      />
      <ToggleRow
        label="Mode confidentiel"
        description="Désactive le web search et masque les journaux."
        checked={confidentialMode}
        onChange={(value) => {
          onConfidentialModeChange(value);
          if (value) {
            onWebSearchChange(false);
          }
        }}
      />
      {confidentialMode ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          Mode strict activé. Les requêtes resteront dans le périmètre autorisé.
        </div>
      ) : null}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-white/20", disabled && "opacity-60")}> 
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/60">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="h-5 w-5 rounded border border-white/20 bg-[#0B1220] accent-[#22D3EE]"
        aria-label={label}
      />
    </label>
  );
}

function FiltersPanel({
  activeDateFilter,
  onDateFilterChange,
  activeVersionFilter,
  onVersionFilterChange,
  publicationDates,
  entryIntoForce
}: {
  activeDateFilter: string | null;
  onDateFilterChange: (value: string | null) => void;
  activeVersionFilter: string | null;
  onVersionFilterChange: (value: string | null) => void;
  publicationDates: ResearchDeskContext["filters"]["publicationDates"];
  entryIntoForce: ResearchDeskContext["filters"]["entryIntoForce"];
}) {
  const toggle = (current: string | null, next: string) => (current === next ? null : next);
  return (
    <section className="glass-surface space-y-4 rounded-3xl border border-white/12 p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/80">Filtres</h2>
        <Filter className="h-4 w-4 text-white/50" aria-hidden />
      </header>
      <div>
        <p className="text-xs uppercase tracking-wide text-white/60">Publication</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {publicationDates.map((option: ResearchFilterOption) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onDateFilterChange(toggle(activeDateFilter, option.id))}
              className={cn(
                "rounded-full border px-3 py-1 text-xs text-white transition",
                activeDateFilter === option.id
                  ? "border-white/80 bg-white/20"
                  : "border-white/20 bg-white/5 hover:border-white/40"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-white/60">Version</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {entryIntoForce.map((option: ResearchFilterOption) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onVersionFilterChange(toggle(activeVersionFilter, option.id))}
              className={cn(
                "rounded-full border px-3 py-1 text-xs text-white transition",
                activeVersionFilter === option.id
                  ? "border-white/80 bg-white/20"
                  : "border-white/20 bg-white/5 hover:border-white/40"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuickActions({ disabled }: { disabled: boolean }) {
  const actions = [
    { icon: UploadCloud, label: "Téléverser une pièce", href: "/upload" },
    { icon: Sparkles, label: "Nouveau plan", href: "/agent/bench" },
    { icon: ArrowUpRight, label: "Escalader HITL", href: "/hitl" }
  ];
  return (
    <section className="glass-surface space-y-3 rounded-3xl border border-white/12 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/80">Actions rapides</h2>
      <div className="space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className={cn(
                "flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:border-white/30 hover:bg-white/10",
                disabled && "pointer-events-none opacity-50"
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-white/70" aria-hidden />
                {action.label}
              </span>
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  suggestions,
  onSuggestion,
  confidentialMode
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
  suggestions: string[];
  onSuggestion: (suggestion: string) => void;
  confidentialMode: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3" aria-label="Compositeur de message">
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="flex-1 rounded-3xl border border-white/12 bg-[#0B1220]/80 p-3">
          <Textarea
            placeholder="Décrivez la question juridique ou utilisez /jurisdiction, /deadline, /citecheck..."
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={3}
            className="resize-none border-none bg-transparent text-sm text-white placeholder:text-white/40 focus-visible:ring-0"
            disabled={disabled}
            aria-label="Message à l’agent"
          />
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/50">
            <span className="rounded-full bg-white/5 px-2 py-1">/jurisdiction</span>
            <span className="rounded-full bg-white/5 px-2 py-1">/deadline</span>
            <span className="rounded-full bg-white/5 px-2 py-1">/citecheck</span>
            <span className="rounded-full bg-white/5 px-2 py-1">/bundle</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 md:w-36">
          <Button
            type="submit"
            disabled={disabled}
            className="h-11 rounded-full bg-gradient-to-r from-[#22D3EE] to-[#6366F1] text-sm font-semibold text-[#0B1220] shadow-[0_15px_35px_rgba(99,102,241,0.35)]"
          >
            Envoyer
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={confidentialMode}
            className="h-11 rounded-full border-white/20 bg-white/10 text-sm text-white/70"
          >
            <Mic className="mr-2 h-4 w-4" aria-hidden />
            Voix
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-full border border-dashed border-white/15 text-sm text-white/70"
          >
            <Paperclip className="mr-2 h-4 w-4" aria-hidden />
            Joindre
          </Button>
        </div>
      </div>
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.slice(0, 3).map((suggestion: string) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestion(suggestion)}
              className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:border-white/30 hover:bg-white/10"
            >
              <Check className="mr-1 h-3 w-3" aria-hidden />
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}

function RiskBanner({ level, summary }: { level: ResearchPlan["riskLevel"]; summary: string }) {
  const variant =
    level === "LOW"
      ? "bg-emerald-500/15 text-emerald-100 border-emerald-400/40"
      : level === "HIGH"
      ? "bg-red-500/15 text-red-100 border-red-400/40"
      : "bg-amber-500/15 text-amber-100 border-amber-400/40";
  return (
    <div className={cn("rounded-3xl border px-4 py-3 text-sm", variant)}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold uppercase tracking-wider">Risque {level}</p>
        <span className="text-xs text-white/70">HITL disponible</span>
      </div>
      <p className="mt-2 text-white/80">{summary}</p>
    </div>
  );
}
