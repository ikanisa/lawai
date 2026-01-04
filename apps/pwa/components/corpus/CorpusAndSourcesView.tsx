"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudUpload, DatabaseZap, HardDriveDownload, ListChecks, RefreshCcw, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { corpusDashboardQueryOptions } from "@/lib/queries/corpus";
import {
  type AllowlistSource,
  type CorpusDashboardResponse,
  type IntegrationStatus,
  type IngestionJob,
  type SnapshotEntry,
  type PolicyConfiguration
} from "@/lib/data/corpus";
import { useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const policyLabels: Record<keyof PolicyConfiguration, { label: string; description: string }> = {
  statute_first: {
    label: "Priorité aux textes",
    description: "Toujours citer les sources officielles avant la jurisprudence."
  },
  ohada_preemption_priority: {
    label: "Préemption OHADA",
    description: "Les normes OHADA prévalent sur le droit national."
  },
  binding_language_guardrail: {
    label: "Langue obligatoire",
    description: "Contrôle de la langue juridiquement opposable pour chaque acte."
  },
  sensitive_topic_hitl: {
    label: "HITL sujets sensibles",
    description: "Escalade humaine dès qu’un sujet sensible est détecté."
  },
  confidential_mode: {
    label: "Mode confidentiel",
    description: "Désactive la recherche web pour protéger les données clients."
  }
};

function AllowlistRow({ source, onToggle }: { source: AllowlistSource; onToggle: (enabled: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <p className="text-sm font-medium text-white">{source.name}</p>
        <p className="text-xs text-white/60">
          {source.jurisdiction} · Dernière indexation {new Date(source.lastIndexed).toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={source.type === "official" ? "success" : source.type === "internal" ? "warning" : "outline"}>
          {source.type === "official" ? "Officiel" : source.type === "internal" ? "Interne" : "Secondaire"}
        </Badge>
        <Switch checked={source.enabled} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}

function IntegrationCard({ integration }: { integration: IntegrationStatus }) {
  const tone =
    integration.status === "connected"
      ? "border-emerald-400/40 bg-emerald-500/10"
      : integration.status === "syncing"
        ? "border-cyan-400/40 bg-cyan-500/10"
        : integration.status === "error"
          ? "border-rose-400/40 bg-rose-500/10"
          : "border-white/10 bg-white/5";
  return (
    <div className={cn("rounded-2xl border p-4", tone)}>
      <header className="flex items-center justify-between text-sm font-semibold text-white">
        <span>{integration.name}</span>
        <Badge variant="outline">{integration.provider}</Badge>
      </header>
      <p className="mt-2 text-xs text-white/60">
        {integration.status === "connected"
          ? "Connexion active"
          : integration.status === "syncing"
            ? "Synchronisation en cours"
            : integration.status === "error"
              ? integration.message ?? "Erreur"
              : "Déconnecté"}
      </p>
      {integration.lastSync ? (
        <p className="mt-1 text-xs text-white/50">Dernière synchro {new Date(integration.lastSync).toLocaleString()}</p>
      ) : null}
      {integration.message && integration.status !== "error" ? (
        <p className="mt-2 text-xs text-white/70">{integration.message}</p>
      ) : null}
    </div>
  );
}

function SnapshotCard({ snapshot }: { snapshot: SnapshotEntry }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">{snapshot.label}</p>
      <p className="mt-1 text-xs text-white/60">Créé le {new Date(snapshot.createdAt).toLocaleString()}</p>
      <p className="mt-2 text-xs text-white/60">{snapshot.author}</p>
      <p className="mt-2 text-sm text-white/70">{snapshot.sizeMb.toLocaleString()} Mo</p>
    </div>
  );
}

function IngestionRow({ job }: { job: IngestionJob }) {
  const tone =
    job.status === "ready"
      ? "bg-emerald-500/10 text-emerald-300"
      : job.status === "processing"
        ? "bg-cyan-500/10 text-cyan-200"
        : "bg-rose-500/10 text-rose-200";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between text-sm text-white">
        <span className="font-medium">{job.filename}</span>
        <span className={cn("rounded-full px-2 py-1 text-xs", tone)}>{job.status.toUpperCase()}</span>
      </div>
      <p className="mt-1 text-xs text-white/60">
        {job.jurisdiction} · {new Date(job.submittedAt).toLocaleString()}
      </p>
      <div className="mt-3 h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-gradient-to-r from-[#22D3EE] to-[#6366F1]" style={{ width: `${job.progress}%` }} />
      </div>
      {job.note ? <p className="mt-2 text-xs text-white/60">{job.note}</p> : null}
    </div>
  );
}

export function CorpusAndSourcesView() {
  const telemetry = useTelemetry();
  const { data, isLoading, isError } = useQuery(corpusDashboardQueryOptions());
  const [localData, setLocalData] = useState<CorpusDashboardResponse | null>(null);

  const dashboard = (localData ?? data) as CorpusDashboardResponse | undefined;

  const toggleSource = (source: AllowlistSource, enabled: boolean) => {
    telemetry.emit("allowlist_toggled", {
      sourceId: source.id,
      enabled
    });
    setLocalData((prev) => {
      const base = (prev ?? data) as CorpusDashboardResponse | undefined;
      if (!base) return prev;
      return {
        ...base,
        allowlist: base.allowlist.map((item) =>
          item.id === source.id ? { ...item, enabled, lastIndexed: new Date().toISOString() } : item
        )
      };
    });
  };

  if (isLoading || !dashboard) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Skeleton className="h-[520px] rounded-3xl" />
          <Skeleton className="h-[520px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        Tableau corpus indisponible actuellement.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Corpus & sources</h1>
          <p className="mt-1 text-sm text-white/70">
            Gérez les sources autorisées, suivez les intégrations cloud et contrôlez l’ingestion des documents.
          </p>
        </div>
        <Button variant="secondary" className="gap-2">
          <RefreshCcw className="h-4 w-4" /> Forcer une synchronisation
        </Button>
      </header>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[var(--glass-shadow)]">
            <header className="flex items-center justify-between text-sm font-semibold text-white">
              <span>Allowlist</span>
              <Shield className="h-4 w-4" />
            </header>
            <div className="mt-4 space-y-3">
              {dashboard.allowlist.map((source) => (
                <AllowlistRow key={source.id} source={source} onToggle={(enabled) => toggleSource(source, enabled)} />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <header className="flex items-center gap-2 text-sm font-semibold text-white">
              <DatabaseZap className="h-4 w-4" /> Intégrations
            </header>
            <div className="mt-4 space-y-3">
              {dashboard.integrations.map((integration) => (
                <IntegrationCard key={integration.id} integration={integration} />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <header className="flex items-center gap-2 text-sm font-semibold text-white">
              <ListChecks className="h-4 w-4" /> Garde-fous actifs
            </header>
            <div className="mt-4 space-y-3 text-xs text-white/70">
              {Object.entries(dashboard.policies).map(([key, enabled]) => {
                const meta = policyLabels[key as keyof PolicyConfiguration];
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex flex-col gap-1 rounded-2xl border px-3 py-3",
                      enabled
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                        : "border-white/10 bg-white/5 text-white/70"
                    )}
                  >
                    <div className="flex items-center justify-between text-[13px] font-medium">
                      <span>{meta?.label ?? key}</span>
                      <Badge variant={enabled ? "success" : "outline"} className="rounded-full px-2 py-0 text-[11px]">
                        {enabled ? "Actif" : "Désactivé"}
                      </Badge>
                    </div>
                    {meta?.description ? <p>{meta.description}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[var(--glass-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <HardDriveDownload className="h-4 w-4" /> Snapshots
            </div>
            <Button size="sm" variant="outline" className="gap-2">
              <CloudUpload className="h-4 w-4" /> Nouveau snapshot
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {dashboard.snapshots.map((snapshot) => (
              <SnapshotCard key={snapshot.id} snapshot={snapshot} />
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ListChecks className="h-4 w-4" /> Ingestion & vectorisation
          </div>
          <ScrollArea className="h-[320px] pr-3">
            <div className="space-y-3">
              {dashboard.ingestionJobs.map((job) => (
                <IngestionRow key={job.id} job={job} />
              ))}
            </div>
          </ScrollArea>
        </section>
      </div>
    </div>
  );
}
