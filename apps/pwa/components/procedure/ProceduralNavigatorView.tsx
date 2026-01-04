"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Download,
  MapPinned,
  ShieldOff,
  Workflow
} from "lucide-react";

import { DeadlineWizard } from "@/components/procedure/DeadlineWizard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { proceduralNavigatorQueryOptions } from "@/lib/queries/procedure";
import { type DeadlineComputation, type ProceduralNavigatorData, type ProceduralStep } from "@/lib/data/procedure";
import { useLocale } from "@/lib/i18n/provider";
import { useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const stepVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 }
};

const statusStyles: Record<ProceduralStep["status"], string> = {
  terminé: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  en_cours: "border-sky-400/40 bg-sky-400/10 text-sky-100",
  à_venir: "border-white/10 bg-white/5 text-white/70"
};

const statusLabels: Record<ProceduralStep["status"], string> = {
  terminé: "Terminé",
  en_cours: "En cours",
  à_venir: "À venir"
};

function StepTimeline({
  steps,
  activeStepId,
  onSelect
}: {
  steps: ProceduralStep[];
  activeStepId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ol className="space-y-3" aria-label="Étapes de procédure">
      {steps.map((step) => (
        <motion.li
          key={step.id}
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          className={cn(
            "cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 transition",
            step.id === activeStepId ? "ring-1 ring-sky-400/40" : "hover:border-white/20"
          )}
          onClick={() => onSelect(step.id)}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/50">{step.jurisdiction}</p>
              <p className="text-base font-semibold text-white">{step.title}</p>
            </div>
            <Badge className={cn("text-xs", statusStyles[step.status])}>{statusLabels[step.status]}</Badge>
          </div>
          <p className="mt-2 text-sm text-white/70">{step.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Échéance {new Date(step.dueDate).toLocaleDateString("fr-FR")}
            </span>
            <span className="flex items-center gap-1">
              <Workflow className="h-3.5 w-3.5" aria-hidden />
              {step.tools.join(" · ")}
            </span>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

function createICS(data: ProceduralNavigatorData) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Avocat-AI//Procedure//FR"
  ];
  for (const entry of data.calendarEntries) {
    const toICSDate = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${entry.id}@avocat-ai`);
    lines.push(`DTSTAMP:${toICSDate(new Date().toISOString())}`);
    lines.push(`DTSTART:${toICSDate(entry.start)}`);
    lines.push(`DTEND:${toICSDate(entry.end)}`);
    lines.push(`SUMMARY:${entry.summary}`);
    lines.push(`DESCRIPTION:${entry.description}`);
    lines.push(`LOCATION:${entry.location}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\n");
}

export function ProceduralNavigatorView() {
  const { data, isLoading, isError, refetch } = useQuery(proceduralNavigatorQueryOptions());
  const { toast } = useToast();
  const telemetry = useTelemetry();
  const { formatDateTime, formatCurrency } = useLocale();

  const [activeStepId, setActiveStepId] = useState<string>("");
  const [confidentialMode, setConfidentialMode] = useState(false);

  useEffect(() => {
    if (!data) return;
    if (!activeStepId) {
      const current = data.steps.find((step) => step.status === "en_cours") ?? data.steps[0];
      setActiveStepId(current.id);
    }
    setConfidentialMode(data.confidentialModeDefault);
  }, [data, activeStepId]);

  const activeStep = useMemo(() => {
    if (!data) return null;
    return data.steps.find((step) => step.id === activeStepId) ?? data.steps[0] ?? null;
  }, [data, activeStepId]);

  const handleDeadlineCompute = useCallback(
    (deadline: DeadlineComputation) => {
      if (!data) return;
      telemetry.emit("deadline_computed", {
        jurisdiction: data.jurisdiction,
        daysUntilDue: deadline.daysUntilDue
      });
      toast({
        title: "Deadline vérifié",
        description: `${deadline.label} — ${deadline.daysUntilDue} jours restants`
      });
    },
    [data, telemetry, toast]
  );

  const handleServicePlan = useCallback(
    (option: ProceduralNavigatorData["serviceOptions"][number]) => {
      telemetry.emit("service_plan_generated", {
        method: option.method,
        jurisdiction: option.jurisdiction,
        deadlineHours: option.deadlineHours
      });
      toast({
        title: "Planification envoyée",
        description: `${option.method} — ${option.deadlineHours}h pour exécution`
      });
    },
    [telemetry, toast]
  );

  const handleExportICS = useCallback(() => {
    if (!data) return;
    const content = createICS(data);
    telemetry.emit("ics_generated", {
      jurisdiction: data.jurisdiction,
      eventCount: data.calendarEntries.length
    });
    toast({
      title: "Calendrier exporté",
      description: `${data.calendarEntries.length} évènements ajoutés à l’ICS`
    });
    if (typeof window !== "undefined") {
      const blob = new Blob([content], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${data.matterId}-procedure.ics`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    }
  }, [data, telemetry, toast]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-white">
        <p className="font-semibold">Le navigateur procédural est momentanément indisponible.</p>
        <Button className="mt-4" variant="secondary" onClick={() => refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#34D399]/10 via-[#22D3EE]/10 to-[#6366F1]/10 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
              <Workflow className="h-4 w-4" aria-hidden /> Navigateur procédural
            </div>
            <h1 className="text-3xl font-semibold text-white">{data.matterTitle}</h1>
            <p className="text-sm text-white/70">
              Coordonnez dépôt, signification, audience, jugement et exécution avec déclenchement des outils agents.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <MapPinned className="h-3.5 w-3.5" aria-hidden />
                Juridiction {data.jurisdiction}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                Prochaine échéance {formatDateTime(activeStep?.dueDate ?? data.steps[0].dueDate)}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs uppercase text-white/60">Mode confidentiel</span>
                <span>{confidentialMode ? "Actif" : "Inactif"}</span>
              </div>
              <Switch
                checked={confidentialMode}
                onCheckedChange={(value) => setConfidentialMode(value)}
                aria-label="Basculer le mode confidentiel"
              />
            </div>
            {confidentialMode && (
              <p className="mt-3 flex items-start gap-2 text-xs text-white/70">
                <ShieldOff className="mt-0.5 h-3.5 w-3.5" aria-hidden />
                Web search désactivé, les suggestions se limitent aux sources internes et vector stores autorisés.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Feuille de route</h2>
          <StepTimeline steps={data.steps} activeStepId={activeStepId} onSelect={setActiveStepId} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          {activeStep ? (
            <Tabs defaultValue="checklist">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">{activeStep.title}</h3>
                  <p className="text-sm text-white/70">{activeStep.description}</p>
                </div>
                <TabsList className="bg-white/10">
                  <TabsTrigger value="checklist" className="px-3 py-1 text-sm">
                    Checklist
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="px-3 py-1 text-sm">
                    Documents
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="checklist" className="mt-4 space-y-3">
                <ol className="space-y-3 text-sm text-white/80">
                  {activeStep.checklist.map((item, index) => (
                    <li key={item} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" aria-hidden />
                      <span>
                        <span className="font-medium text-white/90">Étape {index + 1}:</span> {item}
                      </span>
                    </li>
                  ))}
                </ol>
              </TabsContent>
              <TabsContent value="documents" className="mt-4">
                <ul className="grid gap-3 text-sm text-white/80 md:grid-cols-2">
                  {activeStep.documents.map((doc) => (
                    <li key={doc.id} className="rounded-xl border border-white/5 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-white">{doc.label}</span>
                        <Badge className="bg-white/10 text-xs text-white/60">{activeStep.jurisdiction}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-white/50">Préparez une version signée et horodatée.</p>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-sm text-white/70">Sélectionnez une étape dans la feuille de route.</p>
          )}
        </div>
      </section>

      <DeadlineWizard
        deadlines={data.deadlines}
        onCompute={handleDeadlineCompute}
        formatDate={(value) => formatDateTime(new Date(value))}
      />

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Service de procédure</h2>
            <p className="text-sm text-white/60">Planifiez huissier ou signification internationale avec suivi.</p>
          </div>
          <Button variant="secondary" className="gap-2" onClick={handleExportICS}>
            <Download className="h-4 w-4" aria-hidden /> Export ICS
          </Button>
        </div>
        <ScrollArea className="mt-4 max-h-80">
          <ul className="grid gap-4 md:grid-cols-2">
            {data.serviceOptions.map((option) => (
              <li key={option.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">{option.method}</h3>
                    <p className="mt-1 text-sm text-white/70">Juridiction {option.jurisdiction}</p>
                  </div>
                  <Badge className="bg-white/10 text-xs text-white/60">{option.deadlineHours}h</Badge>
                </div>
                <p className="mt-3 text-sm text-white/70">Coût estimé {formatCurrency(option.costEstimate, option.currency)}</p>
                <ul className="mt-3 space-y-2 text-xs text-white/60">
                  {option.requirements.map((requirement) => (
                    <li key={requirement} className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-sky-300" aria-hidden />
                      <span>{requirement}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-4 w-full" onClick={() => handleServicePlan(option)} variant="secondary">
                  Planifier avec l’agent
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Frais à provisionner</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/80">
            {data.courtFees.map((fee) => (
              <li key={fee.id} className="rounded-xl border border-white/5 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white">{fee.label}</span>
                  <span className="text-white">{formatCurrency(fee.amount, fee.currency)}</span>
                </div>
                <p className="mt-2 text-xs text-white/50">Payable à {fee.payableTo}</p>
                <p className="text-xs text-white/40">Réf. {fee.reference}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Rappels calendrier</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/80">
            {data.calendarEntries.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-white/5 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white">{entry.summary}</span>
                  <Badge className="bg-white/10 text-xs text-white/60">
                    {new Date(entry.start).toLocaleDateString("fr-FR")}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-white/60">{entry.description}</p>
                <p className="text-xs text-white/40">{entry.location}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
