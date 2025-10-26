"use client";

import type { FormEvent } from "react";
import Link from "next/link";
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

import { ToolChip } from "@/components/agent/ToolChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { ResearchFilterOption, ResearchPlan, WebSearchMode } from "@/lib/data/research";
import type { JurisdictionCode } from "@/lib/state/ui-store";
import { jurisdictionOptions } from "@/lib/state/ui-store";
import type { ChatMessage, ToolLogEntry } from "@/lib/research/types";
import { cn } from "@/lib/utils";

import { MessageBubble } from "./MessageBubble";

export interface ResearchViewPanelProps {
  plan: ResearchPlan;
  messages: ChatMessage[];
  activeTools: ToolLogEntry[];
  composer: string;
  isStreaming: boolean;
  suggestions: string[];
  confidentialMode: boolean;
  onComposerChange: (value: string) => void;
  onComposerSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSuggestionSelect: (suggestion: string) => void;
}

export interface ResearchControlsProps {
  jurisdiction: JurisdictionCode;
  onJurisdictionChange: (value: JurisdictionCode) => void;
  suggestions: string[];
  confidentialMode: boolean;
  onConfidentialModeChange: (value: boolean) => void;
  webSearchMode: WebSearchMode;
  onWebSearchModeChange: (mode: WebSearchMode) => void;
  fileSearchEnabled: boolean;
  onFileSearchChange: (value: boolean) => void;
  activeDateFilter: string | null;
  onDateFilterChange: (value: string | null) => void;
  activeVersionFilter: string | null;
  onVersionFilterChange: (value: string | null) => void;
  filters: {
    publicationDates: ResearchFilterOption[];
    entryIntoForce: ResearchFilterOption[];
  };
  quickActionsDisabled: boolean;
}

export function ResearchViewPanel({
  plan,
  messages,
  activeTools,
  composer,
  isStreaming,
  suggestions,
  confidentialMode,
  onComposerChange,
  onComposerSubmit,
  onSuggestionSelect
}: ResearchViewPanelProps) {
  return (
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
          onChange={onComposerChange}
          onSubmit={onComposerSubmit}
          disabled={isStreaming}
          suggestions={suggestions}
          onSuggestion={onSuggestionSelect}
          confidentialMode={confidentialMode}
        />
      </div>
    </section>
  );
}

export function ResearchControls({
  jurisdiction,
  onJurisdictionChange,
  suggestions,
  confidentialMode,
  onConfidentialModeChange,
  webSearchMode,
  onWebSearchModeChange,
  fileSearchEnabled,
  onFileSearchChange,
  activeDateFilter,
  onDateFilterChange,
  activeVersionFilter,
  onVersionFilterChange,
  filters,
  quickActionsDisabled
}: ResearchControlsProps) {
  return (
    <div className="space-y-4" aria-label="Outils de requête">
      <JurisdictionRouter
        jurisdiction={jurisdiction}
        onChange={onJurisdictionChange}
        suggestions={suggestions}
      />
      <ToolToggles
        confidentialMode={confidentialMode}
        onConfidentialModeChange={onConfidentialModeChange}
        webSearchMode={webSearchMode}
        onWebSearchModeChange={onWebSearchModeChange}
        fileSearchEnabled={fileSearchEnabled}
        onFileSearchChange={onFileSearchChange}
        disabled={confidentialMode}
      />
      <FiltersPanel
        activeDateFilter={activeDateFilter}
        onDateFilterChange={onDateFilterChange}
        activeVersionFilter={activeVersionFilter}
        onVersionFilterChange={onVersionFilterChange}
        publicationDates={filters.publicationDates}
        entryIntoForce={filters.entryIntoForce}
      />
      <QuickActions disabled={quickActionsDisabled} />
    </div>
  );
}

export function ResearchSkeleton() {
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
  webSearchMode,
  onWebSearchModeChange,
  fileSearchEnabled,
  onFileSearchChange,
  disabled
}: {
  confidentialMode: boolean;
  onConfidentialModeChange: (value: boolean) => void;
  webSearchMode: WebSearchMode;
  onWebSearchModeChange: (mode: WebSearchMode) => void;
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
      <WebSearchModeSelector
        value={webSearchMode}
        onChange={onWebSearchModeChange}
        disabled={disabled}
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
            onWebSearchModeChange("disabled");
          }
        }}
      />
      {confidentialMode ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          Mode strict activé. La recherche web est suspendue et les journaux sont masqués.
        </div>
      ) : null}
    </section>
  );
}

function WebSearchModeSelector({
  value,
  onChange,
  disabled
}: {
  value: WebSearchMode;
  onChange: (mode: WebSearchMode) => void;
  disabled: boolean;
}) {
  const options: Array<{ label: string; value: WebSearchMode; description: string }> = [
    {
      label: "Autorisé",
      value: "allowlist",
      description: "Le moteur ne consulte que les sources administratives.",
    },
    {
      label: "Large",
      value: "broad",
      description: "Inclut les publications officielles et doctrines tierces.",
    },
    {
      label: "Désactivé",
      value: "disabled",
      description: "Aucun appel externe ne sera réalisé durant l'investigation.",
    },
  ];

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Mode de recherche web">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled}
          className={cn(
            "w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm text-white/70 transition",
            option.value === value && "border-white/40 bg-white/10 text-white"
          )}
          aria-pressed={option.value === value}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{option.label}</span>
            {option.value === value ? <Check className="h-4 w-4" aria-hidden /> : null}
          </div>
          <p className="mt-1 text-xs text-white/60">{option.description}</p>
        </button>
      ))}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-2xl border border-white/12 bg-white/5 p-3">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/60">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-white/30 bg-white/10"
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
  publicationDates: ResearchFilterOption[];
  entryIntoForce: ResearchFilterOption[];
}) {
  return (
    <section className="glass-surface space-y-4 rounded-3xl border border-white/12 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/80">Filtres</h2>
        <Filter className="h-4 w-4 text-white/50" aria-hidden />
      </div>
      <FilterGroup
        label="Publication"
        options={publicationDates}
        activeValue={activeDateFilter}
        onChange={onDateFilterChange}
      />
      <FilterGroup
        label="Version"
        options={entryIntoForce}
        activeValue={activeVersionFilter}
        onChange={onVersionFilterChange}
      />
    </section>
  );
}

function FilterGroup({
  label,
  options,
  activeValue,
  onChange
}: {
  label: string;
  options: ResearchFilterOption[];
  activeValue: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-white/60">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value === activeValue ? null : option.value)}
            className={cn(
              "rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs text-white/70 transition",
              option.value === activeValue && "border-white/40 bg-white/10 text-white"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
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
      : level === "MED"
        ? "bg-amber-500/15 text-amber-100 border-amber-400/40"
        : "bg-rose-500/15 text-rose-100 border-rose-400/40";

  return (
    <section className={cn("rounded-3xl border p-4", variant)} aria-live="polite">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em]">Niveau de risque</p>
          <p className="mt-1 text-base font-semibold">{level}</p>
        </div>
        <Badge variant="outline" className="rounded-full border-white/40 bg-white/10 text-xs text-white">
          {level === "LOW" ? "Faible" : level === "MED" ? "Modéré" : "Élevé"}
        </Badge>
      </div>
      <p className="mt-3 text-sm text-white/90">{summary}</p>
    </section>
  );
}

