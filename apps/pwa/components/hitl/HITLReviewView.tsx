"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Filter, Languages, Scale } from "lucide-react";

import { Badge } from '@avocat-ai/ui';
import { Button } from '@avocat-ai/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from '@avocat-ai/ui';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from '@avocat-ai/ui';
import { hitlQueueQueryOptions } from "@/lib/queries/hitl";
import { type HitlReviewItem, type HitlOutcome } from "@/lib/data/hitl";
import { useTelemetry } from "@/lib/telemetry";

const riskTone: Record<HitlReviewItem["riskLevel"], string> = {
  low: "bg-emerald-500/20 text-emerald-300",
  medium: "bg-amber-500/20 text-amber-300",
  high: "bg-rose-500/20 text-rose-300"
};

export function HITLReviewView() {
  const telemetry = useTelemetry();
  const { data, isLoading, isError } = useQuery(hitlQueueQueryOptions());
  const [riskFilter, setRiskFilter] = useState<"all" | HitlReviewItem["riskLevel"]>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | HitlReviewItem["litigationType"]>("all");
  const [translationOnly, setTranslationOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<HitlOutcome | null>(null);
  const [comment, setComment] = useState("");

  const queue = useMemo<HitlReviewItem[]>(() => data?.queue ?? [], [data]);

  const filteredQueue = useMemo<HitlReviewItem[]>(() => {
    return queue.filter((item: HitlReviewItem) => {
      const matchesRisk = riskFilter === "all" || item.riskLevel === riskFilter;
      const matchesType = typeFilter === "all" || item.litigationType === typeFilter;
      const matchesTranslation = !translationOnly || item.requiresTranslationCheck;
      return matchesRisk && matchesType && matchesTranslation;
    });
  }, [queue, riskFilter, typeFilter, translationOnly]);

  const activeReview = useMemo(() => {
    if (!filteredQueue.length) return null;
    return filteredQueue.find((item) => item.id === selectedId) ?? filteredQueue[0];
  }, [filteredQueue, selectedId]);

  const openAction = (outcome: HitlOutcome) => {
    setAction(outcome);
    setComment("");
  };

  const confirmAction = () => {
    if (!activeReview || !action) return;
    const latencyMs = Date.now() - new Date(activeReview.submittedAt).getTime();
    telemetry.emit("hitl_submitted", {
      reviewId: activeReview.id,
      outcome: action,
      latencyMs
    });
    telemetry.emit("hitl_latency_measured", { reviewId: activeReview.id, latencyMs });
    setAction(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <Skeleton className="h-[520px] rounded-3xl" />
          <Skeleton className="h-[520px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        Impossible de charger la file HITL. Veuillez réessayer.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Revue humaine (HITL)</h1>
          <p className="mt-1 text-sm text-white/70">
            Priorisez les demandes sensibles, comparez les IRAC générées et validez les actions des agents.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
          <Filter className="h-4 w-4" /> {filteredQueue.length} éléments en file
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[var(--glass-shadow)]">
          <header className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">File d’attente</span>
            <Tabs
              value={riskFilter}
              onValueChange={(value) => setRiskFilter(value as typeof riskFilter)}
              className="rounded-2xl bg-white/10 p-1"
            >
              <TabsList className="grid h-auto grid-cols-4 gap-1 rounded-xl bg-transparent">
                {[
                  { id: "all", label: "Tous" },
                  { id: "high", label: "Élevé" },
                  { id: "medium", label: "Modéré" },
                  { id: "low", label: "Faible" }
                ].map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} className="rounded-lg px-2 py-1 text-xs text-white/70">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </header>

          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/60">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              <span>Traduction requise</span>
              <Switch checked={translationOnly} onCheckedChange={setTranslationOnly} />
            </div>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
                <SelectTrigger className="h-9 w-[160px] border-white/10 bg-white/5 text-xs text-white">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-[#0B1220] text-white">
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="civil">Civil</SelectItem>
                  <SelectItem value="labor">Social</SelectItem>
                  <SelectItem value="administrative">Administratif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="mt-4 h-[520px] pr-2">
            <div className="space-y-2">
              {filteredQueue.map((item: HitlReviewItem) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    activeReview?.id === item.id
                      ? "border-cyan-400/40 bg-cyan-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>{new Date(item.submittedAt).toLocaleString()}</span>
                    <Badge className={riskTone[item.riskLevel]}>{item.riskLevel.toUpperCase()}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{item.matter}</p>
                  <p className="mt-1 text-xs text-white/60">{item.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/50">
                    <span className="rounded-full bg-white/10 px-2 py-1">{item.agent}</span>
                    <span className="rounded-full bg-white/10 px-2 py-1">{item.locale}</span>
                    {item.requiresTranslationCheck ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-200">Traduction</span>
                    ) : null}
                  </div>
                </button>
              ))}
              {!filteredQueue.length ? (
                <p className="text-sm text-white/60">
                  Aucun dossier ne correspond à ces filtres.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </section>

        <section className="space-y-4">
          {activeReview ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[var(--glass-shadow)]">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/60">Affaire</p>
                  <h2 className="text-xl font-semibold text-white">{activeReview.matter}</h2>
                  <p className="mt-1 text-sm text-white/60">Agent {activeReview.agent} · Locale {activeReview.locale}</p>
                </div>
                <Badge className={riskTone[activeReview.riskLevel]}>{activeReview.riskLevel.toUpperCase()}</Badge>
              </header>

              <div className="mt-6 space-y-4">
                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <header className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Scale className="h-4 w-4" /> Analyse IRAC
                  </header>
                  <div className="mt-3 space-y-3 text-sm text-white/80">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">Issue</p>
                      <p className="text-white">{activeReview.irac.issue}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">Rules</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {activeReview.irac.rules.map((rule: string) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">Application</p>
                      <p>{activeReview.irac.application}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">Conclusion</p>
                      <p>{activeReview.irac.conclusion}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <header className="flex items-center gap-2 text-sm font-semibold text-white">
                    <CheckCircle2 className="h-4 w-4" /> Évidence & citations
                  </header>
                  <ul className="mt-3 space-y-2 text-sm text-white/80">
                    {activeReview.evidence.map((item: HitlReviewItem["evidence"][number]) => (
                      <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="font-medium text-white">{item.label}</p>
                        <p className="text-xs text-white/60">{item.type.toUpperCase()} · {item.uri}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 rounded-2xl border border-dashed border-white/20 p-3 text-xs text-white/60">
                    Deltas détectés : {activeReview.deltas.join(" · ")}
                  </div>
                </section>
              </div>

              <footer className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <Button variant="outline" onClick={() => openAction("rejected")}>Rejeter</Button>
                <Button variant="secondary" onClick={() => openAction("changes_requested")}>
                  Demander des modifications
                </Button>
                <Button onClick={() => openAction("approved")}>Approuver</Button>
              </footer>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/20 p-6 text-white/60">
              Sélectionnez un dossier pour effectuer la revue.
            </div>
          )}
        </section>
      </div>

      <Dialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent className="max-w-lg bg-[#0B1220]/95 text-white">
          <DialogHeader>
            <DialogTitle>Confirmer la décision</DialogTitle>
            <DialogDescription className="text-white/70">
              Ajoutez un commentaire pour tracer la décision et notifier l’équipe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Motiver la décision..."
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="border-white/20 bg-white/5"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setAction(null)}>
                Annuler
              </Button>
              <Button onClick={confirmAction}>Confirmer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
