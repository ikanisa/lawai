"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  PlayCircle,
  Sparkles,
  TimerReset
} from "lucide-react";

import { Button } from '@avocat-ai/ui';
import { Badge } from '@avocat-ai/ui';
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from '@avocat-ai/ui';
import { useLocale } from "@/lib/i18n/provider";
import { workspaceOverviewQueryOptions } from "@/lib/queries/workspace";
import {
  type ComplianceItem,
  type HitlItem,
  type WorkspaceMatter,
  type WorkspaceShortcut
} from "@/lib/data/workspace";
import { useTelemetry } from "@/lib/telemetry";
import { useUIState } from "@/lib/state/ui-store";
import { cn } from "@/lib/utils";
import { VoiceBar } from "@/components/voice/VoiceBar";

const slashCommands = [
  "/jurisdiction",
  "/deadline",
  "/citecheck",
  "/bundle"
];

const suggestionPrompts = [
  "Synthétise l’audience OHADA de ce matin et prépare les actions suivantes",
  "Compare les obligations de conformité RGPD pour Banque Helios et SARL Lumière",
  "Prépare une liste des pièces manquantes pour le dossier URSSAF"
];

type PlanStepStatus = "done" | "active" | "pending";

interface PlanPreviewStep {
  id: string;
  title: string;
  status: PlanStepStatus;
  tool: string;
  summary: string;
}

interface PlanPreview {
  title: string;
  description: string;
  steps: PlanPreviewStep[];
  citations: { id: string; label: string }[];
}

const planPreview: PlanPreview = {
  title: "Plan audience — Banque Helios",
  description:
    "Étapes préparées par l’agent pour sécuriser l’audience et vérifier les fondements OHADA / droit français.",
  steps: [
    {
      id: "1",
      title: "Analyser l’assignation et extraire les griefs",
      status: "done",
      tool: "document_parser",
      summary: "Synthèse IRAC générée, points sensibles identifiés."
    },
    {
      id: "2",
      title: "Calculer les délais procéduraux",
      status: "active",
      tool: "deadlineCalculator",
      summary: "Audience fixée au 18/06 — délai de conclusions défense restant : 6 jours."
    },
    {
      id: "3",
      title: "Vérifier la compétence OHADA",
      status: "pending",
      tool: "routeJurisdiction",
      summary: "Besoin de confirmer la clause attributive et la résidence des parties."
    }
  ],
  citations: [
    { id: "eli:fr:legifrance:code:commerce:20240101:art:L110-1", label: "C. com. art. L110-1" },
    { id: "eli:ohada:acte:commerce:20240115:art:5", label: "Acte uniforme OHADA art. 5" }
  ]
};

const heroGradientClass = "bg-gradient-to-r from-[#22D3EE] to-[#6366F1]";

export function WorkspaceView() {
  const router = useRouter();
  const { formatDateTime, formatDate } = useLocale();
  const telemetry = useTelemetry();
  const setPlanDrawerOpen = useUIState((state) => state.setPlanDrawerOpen);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [prompt, setPrompt] = useState("");

  const { data, isLoading, isError } = useQuery(workspaceOverviewQueryOptions());

  const matters = data?.recentMatters ?? [];
  const compliance = data?.complianceWatch ?? [];
  const hitl = data?.hitlInbox ?? [];
  const shortcuts = data?.shortcuts ?? [];

  const handleSuggestion = useCallback((suggestion: string) => {
    setPrompt(suggestion);
    textAreaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!prompt.trim()) return;
      telemetry.emit("run_submitted", { agentId: "concierge", inputLength: prompt.trim().length });
      setPrompt("");
    },
    [prompt, telemetry]
  );

  const handleQuickAction = useCallback(
    (action: WorkspaceShortcut) => {
      telemetry.emit("run_submitted", {
        agentId: action.agentId,
        inputLength: action.prefill ? action.prefill.length : 0
      });
      router.push(action.href);
    },
    [router, telemetry]
  );

  const handleCitationClick = useCallback(
    (citationId: string) => {
      telemetry.emit("citation_clicked", { citationId, context: "chat" });
    },
    [telemetry]
  );

  const planStepIcon = useCallback((status: PlanStepStatus) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />;
      case "active":
        return <PlayCircle className="h-4 w-4 text-sky-300" aria-hidden />;
      default:
        return <CircleDashed className="h-4 w-4 text-white/40" aria-hidden />;
    }
  }, []);

  return (
    <div className="space-y-10">
      <section className={cn("rounded-[calc(var(--radius-xl)+12px)] p-[1px] shadow-[var(--shadow-z2)]", heroGradientClass)}>
        <div className="glass-panel rounded-[calc(var(--radius-xl)-2px)] p-8">
          <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
            <header className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.38em] text-white/70">
                Concierge agent-first
              </p>
              <h1 className="text-3xl font-semibold text-white">
                Que souhaitez-vous confier à l’agent aujourd’hui ?
              </h1>
              <p className="text-sm text-white/70">
                Utilisez les commandes ci-dessous ou votre voix pour guider l’agent.
              </p>
            </header>
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="flex-1 space-y-3">
                <Textarea
                  ref={textAreaRef}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Décrivez la tâche, ajoutez /jurisdiction ou /deadline pour affiner."
                  className="min-h-[7.5rem] resize-none border-white/15 bg-white/5 text-base text-white placeholder:text-white/60"
                  aria-label="Demande à l’agent"
                />
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-2" aria-label="Raccourcis slash commands">
                    {slashCommands.map((command) => (
                      <span
                        key={command}
                        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[#22D3EE]" aria-hidden />
                        {command}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <VoiceBar
                      className="w-full max-w-xs"
                      onTranscript={(text) => {
                        setPrompt((prev) => (prev ? `${prev}\n${text}` : text));
                        textAreaRef.current?.focus();
                      }}
                    />
                    <Button
                      type="submit"
                      className="rounded-full bg-white px-6 text-xs font-semibold uppercase tracking-[0.32em] text-[#0B1220]"
                      disabled={!prompt.trim()}
                    >
                      Confier à l’agent
                    </Button>
                  </div>
                </div>
              </div>
              <aside className="flex w-full flex-1 flex-col gap-3 rounded-3xl border border-white/10 bg-white/10 p-4">
                <p className="text-sm font-semibold text-white">Suggestions contextualisées</p>
                <ul className="flex flex-col gap-2" role="list">
                  {suggestionPrompts.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        onClick={() => handleSuggestion(suggestion)}
                        className="w-full rounded-2xl border border-white/10 bg-[#0F172A]/60 px-4 py-3 text-left text-sm text-white/80 transition hover:border-white/20 hover:text-white"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </form>
        </div>
      </section>

      <section aria-labelledby="workspace-quick-actions" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="workspace-quick-actions" className="text-lg font-semibold text-white">
            Actions rapides
          </h2>
          <p className="text-xs uppercase tracking-[0.32em] text-white/60">Raccourcis agent</p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[var(--shadow-z1)]"
              >
                <div className="space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>
            ))
          ) : isError ? (
            <div className="md:col-span-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              Impossible de charger les actions rapides.
            </div>
          ) : (
            shortcuts.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[var(--shadow-z1)]"
              >
                <div className="flex h-full flex-col gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-xs text-white/70">{item.description}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleQuickAction(item)}
                    className="mt-auto w-full rounded-full bg-gradient-to-r from-[#22D3EE] to-[#6366F1] text-xs font-semibold uppercase tracking-[0.28em]"
                  >
                    Lancer
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3" aria-label="Synthèse agent">
        <div className="glass-surface col-span-2 space-y-4 rounded-3xl border border-white/12 p-6">
          <header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Dossiers récents</h3>
            <Link
              href="/matters"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-white/70 hover:text-white"
            >
              Voir tout
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </header>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-2 h-4 w-64" />
                  <Skeleton className="mt-3 h-4 w-40" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-white/70">Impossible de charger les dossiers récents.</p>
          ) : (
            <ul className="space-y-3" role="list">
              {matters.map((matter) => (
                <li key={matter.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{matter.title}</p>
                      <p className="text-xs text-white/60">{matter.parties}</p>
                    </div>
                    <Badge className={riskBadgeClass(matter.risk)}>{matter.risk}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/70">
                    <span className="flex items-center gap-1">
                      <TimerReset className="h-3.5 w-3.5" aria-hidden />
                      {matter.stage}
                    </span>
                    <span aria-label="Dernière mise à jour">
                      MAJ {formatDateTime(new Date(matter.updatedAt))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-surface space-y-4 rounded-3xl border border-white/12 p-6">
            <header className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Veille conformité</h3>
              <Badge className="bg-white/10 text-xs uppercase tracking-[0.32em] text-white">
                {compliance.length} suivis
              </Badge>
            </header>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="mt-2 h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <p className="text-sm text-white/70">Impossible de charger la veille conformité.</p>
            ) : (
              <ul className="space-y-3" role="list">
                {compliance.map((item) => (
                  <ComplianceRow key={item.id} item={item} formatDate={formatDate} />
                ))}
              </ul>
            )}
          </div>

          <div className="glass-surface space-y-4 rounded-3xl border border-white/12 p-6">
            <header className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">File HITL</h3>
              <Badge className="bg-gradient-to-r from-[#F59E0B] to-[#F97316] text-[10px] uppercase tracking-[0.32em] text-black">
                {hitl.length} revues
              </Badge>
            </header>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="mt-2 h-4 w-52" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <p className="text-sm text-white/70">Impossible de charger la file HITL.</p>
            ) : (
              <ul className="space-y-3" role="list">
                {hitl.map((item) => (
                  <HitlRow key={item.id} item={item} formatDateTime={formatDateTime} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="plan-preview" className="glass-surface rounded-3xl border border-white/12 p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="plan-preview" className="text-lg font-semibold text-white">
              {planPreview.title}
            </h2>
            <p className="mt-1 text-sm text-white/70">{planPreview.description}</p>
          </div>
          <Button
            type="button"
            onClick={() => setPlanDrawerOpen(true)}
            className="rounded-full bg-gradient-to-r from-[#22D3EE] to-[#6366F1] text-xs font-semibold uppercase tracking-[0.32em]"
          >
            Ouvrir le plan
          </Button>
        </header>
        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ul className="space-y-3" role="list">
            {planPreview.steps.map((step) => (
              <li key={step.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5">{planStepIcon(step.status)}</span>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <Badge variant="outline" className="border-white/20 text-[10px] uppercase tracking-[0.28em] text-white/70">
                        {step.tool}
                      </Badge>
                    </div>
                    <p className="text-xs text-white/70">{step.summary}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Citations clés</h3>
            <ul className="space-y-2" role="list">
              {planPreview.citations.map((citation) => (
                <li key={citation.id}>
                  <button
                    type="button"
                    onClick={() => handleCitationClick(citation.id)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#0F172A]/70 px-4 py-3 text-left text-xs text-white/80 transition hover:border-white/20 hover:text-white"
                  >
                    <span>{citation.label}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </div>
  );
}

function riskBadgeClass(risk: WorkspaceMatter["risk"]) {
  switch (risk) {
    case "ÉLEVÉ":
      return "bg-gradient-to-r from-[#F43F5E] to-[#FB7185] text-white";
    case "MOYEN":
      return "bg-gradient-to-r from-[#F59E0B] to-[#F97316] text-black";
    default:
      return "bg-gradient-to-r from-[#34D399] to-[#3B82F6] text-white";
  }
}

function ComplianceRow({
  item,
  formatDate
}: {
  item: ComplianceItem;
  formatDate: (date: Date) => string;
}) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="outline" className="border-white/20 text-[10px] uppercase tracking-[0.32em] text-white/70">
          {item.jurisdiction}
        </Badge>
        <span className="text-xs text-white/60">{formatDate(new Date(item.effectiveDate))}</span>
      </div>
      <p className="mt-3 text-sm text-white/80">{item.summary}</p>
      <p className="mt-2 text-xs text-white/50">Réf. {item.reference}</p>
    </li>
  );
}

function HitlRow({
  item,
  formatDateTime
}: {
  item: HitlItem;
  formatDateTime: (date: Date) => string;
}) {
  const badgeClass = item.risk === "élevé" ? "bg-[#F43F5E]/20 text-[#FECACA]" : "bg-white/10 text-white/80";
  return (
    <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{item.title}</p>
        <Badge className={cn("text-[10px] uppercase tracking-[0.32em]", badgeClass)}>Risque {item.risk}</Badge>
      </div>
      <p className="mt-2 text-xs text-white/70">{item.reason}</p>
      <p className="mt-3 text-xs text-white/60">Due {formatDateTime(new Date(item.dueAt))}</p>
    </li>
  );
}
