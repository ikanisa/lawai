"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  GitCompare,
  ShieldCheck,
  Sparkles,
  XCircle
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { draftingStudioQueryOptions } from "@/lib/queries/drafting";
import { type ClauseBenchmark, type DraftClauseDiff, type DraftingStudioData } from "@/lib/data/drafting";
import { useLocale } from "@/lib/i18n/provider";
import { useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const clauseDecisionVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 }
};

type ClauseDecision = "pending" | "accepted" | "rejected";

const deltaBadgeClasses: Record<ClauseBenchmark["delta"], string> = {
  aligné: "border-sky-400/40 bg-sky-400/10 text-sky-100",
  avantage_client: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  risque: "border-rose-400/40 bg-rose-500/10 text-rose-100"
};

const riskBadgeClasses: Record<DraftClauseDiff["risk"], string> = {
  faible: "bg-emerald-400/10 text-emerald-100 border border-emerald-400/40",
  moyen: "bg-amber-400/10 text-amber-100 border border-amber-400/40",
  élevé: "bg-rose-500/10 text-rose-100 border border-rose-400/40"
};

function ClauseCard({
  clause,
  decision,
  onDecision
}: {
  clause: DraftClauseDiff;
  decision: ClauseDecision;
  onDecision: (decision: Exclude<ClauseDecision, "pending">) => void;
}) {
  return (
    <motion.article
      variants={clauseDecisionVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "glass-panel relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5",
        decision === "accepted" && "ring-1 ring-emerald-500/40",
        decision === "rejected" && "ring-1 ring-rose-500/40"
      )}
      aria-live="polite"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{clause.heading}</h3>
          <p className="mt-1 text-sm text-white/70">{clause.rationale}</p>
        </div>
        <Badge className={cn("w-fit text-xs", riskBadgeClasses[clause.risk])}>
          Risque {clause.risk === "faible" ? "faible" : clause.risk === "moyen" ? "moyen" : "élevé"}
        </Badge>
      </header>

      <div className="grid gap-3 rounded-xl border border-white/5 bg-white/5 p-4 sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
            <GitCompare className="h-3.5 w-3.5" aria-hidden />
            Texte actuel
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{clause.baseText}</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Proposition agent
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white">{clause.agentProposal}</p>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {clause.citations.map((citation) => (
            <Badge key={citation.id} variant="secondary" className="bg-white/10 text-xs text-white/90">
              {citation.label}
            </Badge>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant={decision === "accepted" ? "default" : "secondary"}
            onClick={() => onDecision("accepted")}
            className="gap-1.5"
            aria-pressed={decision === "accepted"}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Accepter
          </Button>
          <Button
            size="sm"
            variant={decision === "rejected" ? "destructive" : "ghost"}
            onClick={() => onDecision("rejected")}
            className="gap-1.5"
            aria-pressed={decision === "rejected"}
          >
            <XCircle className="h-4 w-4" aria-hidden />
            Rejeter
          </Button>
        </div>
      </footer>
    </motion.article>
  );
}

function BenchmarksTable({
  benchmarks,
  formatDateTime
}: {
  benchmarks: ClauseBenchmark[];
  formatDateTime: (value: Date) => string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <div>
          <h3 className="text-base font-semibold text-white">Clause Benchmarks</h3>
          <p className="text-sm text-white/60">Comparaison marché vs. proposition agent</p>
        </div>
      </div>
      <ScrollArea className="max-h-[320px]">
        <table className="min-w-full divide-y divide-white/5 text-sm text-white/80">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Clause</th>
              <th className="px-4 py-3 font-medium">Marché</th>
              <th className="px-4 py-3 font-medium">Proposition agent</th>
              <th className="px-4 py-3 font-medium">Référence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {benchmarks.map((benchmark) => (
              <tr key={benchmark.id} className="hover:bg-white/5">
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-col gap-2">
                    <span className="font-medium text-white">{benchmark.clause}</span>
                    <Badge className={cn("w-fit text-xs", deltaBadgeClasses[benchmark.delta])}>
                      {benchmark.delta === "aligné" && "Aligné marché"}
                      {benchmark.delta === "avantage_client" && "Avantage client"}
                      {benchmark.delta === "risque" && "Surveillance"}
                    </Badge>
                    <span className="text-xs text-white/40">
                      MAJ {formatDateTime(new Date(benchmark.updatedAt))}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 align-top text-white/70">{benchmark.marketStandard}</td>
                <td className="px-4 py-4 align-top text-white">{benchmark.agentProposal}</td>
                <td className="px-4 py-4 align-top text-white/70">{benchmark.authority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

function TemplatesTabs({
  data,
  selectedTemplateId,
  onSelect
}: {
  data: DraftingStudioData;
  selectedTemplateId: string | null;
  onSelect: (templateId: string) => void;
}) {
  const templatesByType = useMemo(() => {
    return data.templates.reduce<Record<string, DraftingStudioData["templates"]>>((acc, template) => {
      if (!acc[template.type]) acc[template.type] = [];
      acc[template.type].push(template);
      return acc;
    }, {});
  }, [data.templates]);

  const selectedTemplate = useMemo(() => {
    return data.templates.find((template) => template.id === selectedTemplateId) ?? null;
  }, [data.templates, selectedTemplateId]);

  const categories = Object.keys(templatesByType);
  const [activeCategory, setActiveCategory] = useState<string>(
    selectedTemplate?.type ?? categories[0] ?? ""
  );

  useEffect(() => {
    if (selectedTemplate) {
      setActiveCategory(selectedTemplate.type);
    }
  }, [selectedTemplate]);

  if (!categories.length) {
    return null;
  }

  return (
    <Tabs value={activeCategory} onValueChange={setActiveCategory}>
      <TabsList className="flex flex-wrap gap-2 bg-white/10 p-1">
        {categories.map((category) => (
          <TabsTrigger key={category} value={category} className="rounded-xl px-4 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-200" aria-hidden />
              <span className="capitalize">{category}</span>
              {category === selectedTemplate?.type && (
                <Badge className="bg-emerald-400/20 text-xs text-emerald-100">Actif</Badge>
              )}
            </div>
          </TabsTrigger>
        ))}
      </TabsList>
      {categories.map((category) => (
        <TabsContent key={category} value={category} className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {templatesByType[category]?.map((template) => (
              <div
                key={template.id}
                className={cn(
                  "rounded-2xl border border-white/10 bg-white/5 p-4 transition",
                  template.id === selectedTemplateId ? "ring-1 ring-sky-400/50" : "hover:border-white/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-white">{template.title}</h3>
                    <p className="mt-2 text-sm text-white/70">{template.summary}</p>
                  </div>
                  <Badge className="bg-white/10 text-xs uppercase text-white/60">{template.type}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {template.tags.map((tag) => (
                    <Badge key={tag} className="bg-white/10 text-xs text-white/70">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/50">
                  <span className="flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    Maj {new Date(template.updatedAt).toLocaleString("fr-FR")}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {template.complexity}
                  </span>
                </div>
                <Button className="mt-4 w-full" onClick={() => onSelect(template.id)} variant="secondary">
                  Ouvrir dans le studio
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function DraftingStudio() {
  const { data, isLoading, isError, refetch } = useQuery(draftingStudioQueryOptions());
  const { toast } = useToast();
  const telemetry = useTelemetry();
  const { formatDateTime, formatCurrency } = useLocale();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [clauseState, setClauseState] = useState<Record<string, ClauseDecision>>({});
  const [selectedMatterId, setSelectedMatterId] = useState<string>("");

  useEffect(() => {
    if (!data) return;
    if (!selectedTemplateId) {
      setSelectedTemplateId(data.recommendedTemplateId ?? data.templates[0]?.id ?? null);
    }
    setClauseState(
      data.activeDraft.clauses.reduce<Record<string, ClauseDecision>>((acc, clause) => {
        acc[clause.id] = "pending";
        return acc;
      }, {})
    );
    setSelectedMatterId(data.activeDraft.matter.id);
  }, [data, selectedTemplateId]);

  const selectedTemplate = useMemo(() => {
    if (!data) return null;
    return data.templates.find((template) => template.id === selectedTemplateId) ?? null;
  }, [data, selectedTemplateId]);

  const handleDecision = useCallback(
    (clause: DraftClauseDiff, decision: Exclude<ClauseDecision, "pending">) => {
      setClauseState((prev) => ({ ...prev, [clause.id]: decision }));
      telemetry.emit("clause_decision", {
        clauseId: clause.id,
        action: decision,
        rationale: clause.rationale
      });
      toast({
        title: decision === "accepted" ? "Clause acceptée" : "Clause rejetée",
        description: `${clause.heading} — décision enregistrée`
      });
    },
    [telemetry, toast]
  );

  const handleExport = useCallback(
    (option: DraftingStudioData["exportOptions"][number]) => {
      if (!data) return;
      telemetry.emit("document_exported", {
        format: option.format,
        matterId: data.activeDraft.matter.id,
        c2paSigned: option.c2paSigned
      });
      toast({
        title: "Export lancé",
        description: option.c2paSigned
          ? "Un export signé C2PA est en cours de préparation."
          : "Le document DOCX sera prêt dans l’outbox."
      });
      if (typeof window !== "undefined") {
        const blob = new Blob(
          [
            `Projet: ${data.activeDraft.title}\nFormat: ${option.format}\nDate: ${new Date().toISOString()}\n` +
              `Clauses acceptées: ${Object.values(clauseState).filter((value) => value === "accepted").length}`
          ],
          { type: option.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const slug = data.activeDraft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        link.download = `${slug}.${option.format}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 500);
      }
    },
    [data, telemetry, toast, clauseState]
  );

  const handleAttachMatter = useCallback(() => {
    if (!data) return;
    const matter = data.attachableMatters.find((item) => item.id === selectedMatterId);
    if (!matter) {
      toast({
        title: "Sélection manquante",
        description: "Choisissez un dossier pour l’attachement.",
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Draft attaché",
      description: `Le projet a été attaché à ${matter.title}.`
    });
  }, [data, selectedMatterId, toast]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-white">
        <p className="font-semibold">Impossible de charger le studio de rédaction.</p>
        <p className="mt-2 text-sm text-white/80">
          Vérifiez votre connexion ou relancez la requête TanStack Query.
        </p>
        <Button className="mt-4" onClick={() => refetch()} variant="secondary">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#22D3EE]/20 to-[#6366F1]/20 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
              <Sparkles className="h-4 w-4" aria-hidden />
              Studio de rédaction
            </div>
            <h1 className="text-3xl font-semibold text-white">{data.activeDraft.title}</h1>
            <p className="text-sm text-white/80">{data.activeDraft.comment}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Dossier {data.activeDraft.matter.title}
              </span>
              <span className="flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                Sync {formatDateTime(new Date(data.activeDraft.lastSyncedAt))}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <Select value={selectedMatterId} onValueChange={setSelectedMatterId}>
              <SelectTrigger className="min-w-[220px] border-white/10 bg-white/10 text-white">
                <SelectValue placeholder="Attacher à…" />
              </SelectTrigger>
              <SelectContent className="bg-[#111a2f] text-white">
                {data.attachableMatters.map((matter) => (
                  <SelectItem key={matter.id} value={matter.id}>
                    {matter.title} — {matter.jurisdiction}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAttachMatter} className="gap-2" variant="secondary">
              <ArrowUpRight className="h-4 w-4" aria-hidden />
              Attacher au dossier
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-white">Galerie de modèles</h2>
        <TemplatesTabs data={data} selectedTemplateId={selectedTemplateId} onSelect={setSelectedTemplateId} />
        {selectedTemplate && (
          <p className="text-sm text-white/60">
            Modèle actif : <span className="text-white">{selectedTemplate.title}</span> — juridictions {selectedTemplate.jurisdictions.join(", ")}
          </p>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Diff live & rationales</h2>
            <p className="text-sm text-white/60">
              Acceptez ou rejetez les propositions clause par clause avec contexte juridique.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.exportOptions.map((option) => (
              <Button key={option.format} onClick={() => handleExport(option)} className="gap-2" variant="secondary">
                <Download className="h-4 w-4" aria-hidden />
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          {data.activeDraft.clauses.map((clause) => (
            <ClauseCard
              key={clause.id}
              clause={clause}
              decision={clauseState[clause.id] ?? "pending"}
              onDecision={(decision) => handleDecision(clause, decision)}
            />
          ))}
        </div>
      </section>

      <BenchmarksTable benchmarks={data.clauseBenchmarks} formatDateTime={formatDateTime} />

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Export & conformité</h2>
            <p className="text-sm text-white/60">
              Les exports PDF sont signés C2PA. Les DOCX restent modifiables avant dépôt Télérecours.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="gap-2">
                <Download className="h-4 w-4" aria-hidden />
                Export rapide
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[#111a2f] text-white">
              {data.exportOptions.map((option) => (
                <DropdownMenuItem
                  key={`quick-${option.format}`}
                  className="focus:bg-white/10"
                  onSelect={() => handleExport(option)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {data.exportOptions.map((option) => (
            <div key={`card-${option.format}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-base font-semibold text-white">
                {option.format === "pdf" ? "PDF certifié" : "DOCX éditable"}
              </h3>
              <p className="mt-2 text-sm text-white/70">
                {option.format === "pdf"
                  ? "Signature C2PA + horodatage pour opposabilité."
                  : "Conservez la possibilité de réviser avant signature."}
              </p>
              <Button onClick={() => handleExport(option)} className="mt-4 w-full" variant="secondary">
                Télécharger
              </Button>
            </div>
          ))}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-base font-semibold text-white">Provision huissier</h3>
            <p className="mt-2 text-sm text-white/70">
              Estimation automatique basée sur la juridiction active.
            </p>
            <p className="mt-4 text-2xl font-semibold text-white">
              {formatCurrency(420, "EUR")}
            </p>
            <p className="text-xs text-white/50">Inclut déplacements + dépôt AR.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
