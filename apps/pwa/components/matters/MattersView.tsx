"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck2, FileText, Scale } from "lucide-react";

import { Button } from '@avocat-ai/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from '@avocat-ai/ui';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/lib/i18n/provider";
import { mattersOverviewQueryOptions } from "@/lib/queries/matters";
import {
  type MatterDeadlineEntry,
  type MatterDocumentNode,
  type MatterSummary,
  type MatterTimelineEvent
} from "@/lib/data/matters";
import { useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const riskLabels: Record<MatterSummary["riskLevel"], { label: string; tone: string }> = {
  low: { label: "Risque faible", tone: "bg-emerald-500/20 text-emerald-300" },
  medium: { label: "Risque modéré", tone: "bg-amber-500/20 text-amber-300" },
  high: { label: "Risque élevé", tone: "bg-rose-500/20 text-rose-300" }
};

function DocumentTree({
  documents,
  depth = 0,
  selected,
  onToggle
}: {
  documents: MatterDocumentNode[];
  depth?: number;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className={cn("space-y-3", depth > 0 && "pl-4 border-l border-white/10")}>
      {documents.map((doc: MatterDocumentNode) => {
        const pressed = selected.has(doc.id);
        const status =
          doc.citeCheck === "clean"
            ? "bg-emerald-500/20 text-emerald-300"
            : doc.citeCheck === "pending"
              ? "bg-amber-500/20 text-amber-300"
              : "bg-rose-500/20 text-rose-300";
        return (
          <div key={doc.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <Toggle
                pressed={pressed}
                onPressedChange={() => onToggle(doc.id)}
                className={cn(
                  "h-auto w-full justify-start rounded-xl border border-white/10 bg-transparent px-3 py-2 text-left text-sm text-white/80",
                  pressed && "border-cyan-400/40 bg-cyan-400/10 text-white"
                )}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-white">{doc.title}</span>
                  <span className="text-xs uppercase tracking-wide text-white/60">
                    {doc.kind === "pleading"
                      ? "Acte"
                      : doc.kind === "evidence"
                        ? "Pièce"
                        : doc.kind === "analysis"
                          ? "Analyse"
                          : doc.kind === "order"
                            ? "Décision"
                            : "Correspondance"}
                  </span>
                </div>
              </Toggle>
              <span className={cn("rounded-full px-2 py-1 text-xs font-medium", status)}>
                {doc.citeCheck === "clean"
                  ? "Cite-check OK"
                  : doc.citeCheck === "pending"
                    ? "En cours"
                    : "À revoir"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/60">
              <span>{new Date(doc.updatedAt).toLocaleString()}</span>
              <span>{doc.author}</span>
            </div>
            {doc.children?.length ? (
              <div className="mt-3">
                <DocumentTree documents={doc.children} depth={depth + 1} selected={selected} onToggle={onToggle} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DeadlineCard({ deadline, onGenerate }: { deadline: MatterDeadlineEntry; onGenerate: () => void }) {
  const tone =
    deadline.status === "passed"
      ? "border-rose-400/40 bg-rose-500/10"
      : deadline.status === "urgent"
        ? "border-amber-400/40 bg-amber-500/10"
        : "border-cyan-400/40 bg-cyan-500/10";
  return (
    <div className={cn("rounded-2xl border p-4", tone)}>
      <div className="flex items-center justify-between gap-3 text-sm font-medium text-white">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {deadline.label}
        </div>
        <Button size="sm" variant="ghost" onClick={onGenerate}>
          Recalculer
        </Button>
      </div>
      <p className="mt-2 text-xs text-white/60">
        {new Date(deadline.dueAt).toLocaleString()} · {deadline.jurisdiction}
      </p>
      <p className="mt-2 text-sm text-white/70">{deadline.note}</p>
    </div>
  );
}

export function MattersView() {
  const { formatDate } = useLocale();
  const telemetry = useTelemetry();
  const { data, isError, isLoading } = useQuery(mattersOverviewQueryOptions());
  const [selectedMatterId, setSelectedMatterId] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [compareName, setCompareName] = useState("Comparatif dossiers");

  const matters = useMemo<MatterSummary[]>(() => data?.matters ?? [], [data]);
  const activeMatter = useMemo<MatterSummary | null>(() => {
    if (!matters.length) return null;
    return matters.find((matter: MatterSummary) => matter.id === selectedMatterId) ?? matters[0];
  }, [matters, selectedMatterId]);

  const documentTitles = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    if (!activeMatter) return map;
    const walk = (nodes: MatterDocumentNode[]) => {
      for (const node of nodes) {
        map.set(node.id, node.title);
        if (node.children?.length) {
          walk(node.children);
        }
      }
    };
    walk(activeMatter.documents);
    return map;
  }, [activeMatter]);

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const emitDeadline = (deadline: MatterDeadlineEntry) => {
    const dueDate = new Date(deadline.dueAt);
    const daysUntil = Math.max(0, Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    telemetry.emit("deadline_computed", {
      jurisdiction: deadline.jurisdiction,
      daysUntilDue: daysUntil
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-[520px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError || !activeMatter) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        Impossible de charger les dossiers pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Dossiers</h1>
          <p className="mt-1 text-sm text-white/70">
            Visualisez le risque, les pièces et les échéances critiques pour chaque affaire.
          </p>
        </div>
        <Tabs
          value={activeMatter.id}
          onValueChange={(value) => {
            setSelectedMatterId(value);
            setSelectedDocs(new Set());
          }}
          className="w-full max-w-2xl"
        >
          <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-2xl bg-white/10 p-2">
            {matters.map((matter: MatterSummary) => (
              <TabsTrigger key={matter.id} value={matter.id} className="rounded-xl px-3 py-2 text-left text-sm text-white/80">
                <div className="flex flex-col">
                  <span className="font-medium text-white">{matter.name}</span>
                  <span className="text-xs text-white/60">
                    {matter.stage} · Audience {formatDate(matter.nextHearing)}
                  </span>
                </div>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[var(--glass-shadow)]">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/60">Vue synthèse</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{activeMatter.name}</h2>
              </div>
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", riskLabels[activeMatter.riskLevel].tone)}>
                {riskLabels[activeMatter.riskLevel].label}
              </span>
            </header>
            <dl className="mt-4 space-y-3 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <dt>Client</dt>
                <dd className="text-white">{activeMatter.client}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Adverse</dt>
                <dd className="text-white">{activeMatter.opposing}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Droit applicable</dt>
                <dd className="text-white">{activeMatter.governingLaw}</dd>
              </div>
              <div>
                <dt className="text-white/60">Question clé</dt>
                <dd className="text-white">{activeMatter.principalIssue}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <CalendarCheck2 className="h-4 w-4" /> Échéancier
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (activeMatter.deadlines[0]) {
                    emitDeadline(activeMatter.deadlines[0]);
                  }
                  setDialogOpen(true);
                }}
              >
                Wizard délai
              </Button>
            </header>
            <div className="mt-4 space-y-3">
              {activeMatter.deadlines.map((deadline: MatterDeadlineEntry) => (
                <DeadlineCard
                  key={deadline.id}
                  deadline={deadline}
                  onGenerate={() => emitDeadline(deadline)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <header className="flex items-center gap-2 text-sm font-semibold text-white">
              <Scale className="h-4 w-4" /> Chronologie
            </header>
            <ol className="mt-4 space-y-3 text-sm text-white/70">
              {activeMatter.timeline.map((event: MatterTimelineEvent) => (
                <li key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>{new Date(event.occurredAt).toLocaleString()}</span>
                    <span>{event.actor}</span>
                  </div>
                  <p className="mt-2 font-medium text-white">{event.label}</p>
                  <p className="mt-1 text-white/70">{event.summary}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[var(--glass-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileText className="h-4 w-4" /> Pièces & notes
            </div>
            <Button disabled={selectedDocs.size < 2} onClick={() => setDialogOpen(true)}>
              Comparer ({selectedDocs.size})
            </Button>
          </div>
          <p className="mt-2 text-sm text-white/70">
            Sélectionnez plusieurs pièces pour lancer la redline et vérifier les citations.
          </p>
          <ScrollArea className="mt-4 h-[520px] pr-3">
            <DocumentTree documents={activeMatter.documents} selected={selectedDocs} onToggle={toggleDoc} />
          </ScrollArea>
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl bg-[#0B1220]/95 text-white">
          <DialogHeader>
            <DialogTitle>Comparatif & cite-check</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-white/70">
              Confirmez le comparatif pour lancer la redline multi-documents et vérifier les références croisées.
            </p>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/60">Nom du comparatif</label>
              <Input
                value={compareName}
                onChange={(event) => setCompareName(event.target.value)}
                className="border-white/20 bg-white/5"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">Documents</p>
              <ul className="mt-2 space-y-1 text-sm text-white/80">
                {Array.from(selectedDocs).map((docId: string) => (
                  <li key={docId}>{documentTitles.get(docId) ?? docId}</li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                disabled={!selectedDocs.size}
                onClick={() => {
                  telemetry.emit("citation_clicked", {
                    citationId: Array.from(selectedDocs)[0] ?? "",
                    context: "matter"
                  });
                  setDialogOpen(false);
                  setSelectedDocs(new Set());
                }}
              >
                Lancer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
