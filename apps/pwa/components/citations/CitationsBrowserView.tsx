"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  BookOpen,
  Filter,
  Link2,
  Search,
  Sparkles,
  TableProperties
} from "lucide-react";

import { Badge } from '@avocat-ai/ui';
import { Button } from '@avocat-ai/ui';
import { Input } from '@avocat-ai/ui';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { citationsBrowserQueryOptions } from "@/lib/queries/citations";
import { type CitationDocument } from "@/lib/data/citations";
import { useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const typeLabels: Record<CitationDocument["type"], string> = {
  statute: "Texte",
  regulation: "Règlement",
  case: "Jurisprudence",
  doctrine: "Doctrine"
};

function DocumentToc({ items, onSelect, activeAnchor }: {
  items: CitationDocument["toc"];
  onSelect: (anchor: string) => void;
  activeAnchor: string | null;
}) {
  return (
    <nav className="space-y-2">
      {items.map((item: CitationDocument["toc"][number]) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.anchor)}
          className={cn(
            "w-full rounded-xl border border-transparent px-3 py-2 text-left text-sm text-white/70 transition",
            activeAnchor === item.anchor && "border-cyan-400/40 bg-cyan-500/10 text-white"
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function MetadataGrid({ metadata }: { metadata: Record<string, string> }) {
  return (
    <dl className="grid grid-cols-1 gap-3 text-sm text-white/70">
      {Object.entries(metadata).map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <dt className="text-xs uppercase tracking-wide text-white/50">{label}</dt>
          <dd className="mt-1 text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CitationsBrowserView() {
  const telemetry = useTelemetry();
  const { data, isLoading, isError } = useQuery(citationsBrowserQueryOptions());
  const [searchTerm, setSearchTerm] = useState("");
  const [jurisdiction, setJurisdiction] = useState<string | "all">("all");
  const [docType, setDocType] = useState<CitationDocument["type"] | "all">("all");
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const results = useMemo<CitationDocument[]>(() => data?.results ?? [], [data]);
  const ohadaFeatured = useMemo<CitationDocument[]>(() => data?.ohadaFeatured ?? [], [data]);

  useEffect(() => {
    if (!results.length) return;
    const now = Date.now();
    const upToDate = results.filter((doc) => new Date(doc.entryIntoForce).getTime() <= now).length;
    telemetry.emit("temporal_validity_checked", { total: results.length, upToDate });
  }, [results, telemetry]);

  const filteredResults = useMemo<CitationDocument[]>(() => {
    return results.filter((doc) => {
      const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesJurisdiction = jurisdiction === "all" || doc.jurisdiction === jurisdiction;
      const matchesType = docType === "all" || doc.type === docType;
      return matchesSearch && matchesJurisdiction && matchesType;
    });
  }, [results, searchTerm, jurisdiction, docType]);

  const activeDocument = useMemo<CitationDocument | null>(() => {
    if (!filteredResults.length) return null;
    const fallback = filteredResults[0];
    return filteredResults.find((doc) => doc.id === activeId) ?? fallback;
  }, [filteredResults, activeId]);

  const selectDocument = (doc: CitationDocument) => {
    setActiveId(doc.id);
    setActiveAnchor(doc.content[0]?.anchor ?? null);
    telemetry.emit("citation_clicked", {
      citationId: doc.id,
      context: "citation_browser"
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 lg:grid-cols-[280px_1fr_320px]">
          <Skeleton className="h-[480px] rounded-3xl" />
          <Skeleton className="h-[480px] rounded-3xl" />
          <Skeleton className="h-[480px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        Recherche indisponible pour le moment. Merci de réessayer plus tard.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Citations officielles</h1>
          <p className="mt-1 text-sm text-white/70">
            Filtrez par juridiction et type pour ouvrir la version consolidée, comparer les versions et ajouter aux preuves.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[var(--glass-shadow)] lg:max-w-lg">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
            <Sparkles className="h-4 w-4" /> OHADA en priorité
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {ohadaFeatured.map((doc: CitationDocument) => (
              <button
                key={doc.id}
                onClick={() => selectDocument(doc)}
                className="min-w-[180px] rounded-2xl border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-left text-sm text-white"
              >
                <span className="font-semibold">{doc.title}</span>
                <p className="mt-1 text-xs text-white/70">{doc.summary}</p>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[var(--glass-shadow)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3">
            <Search className="h-4 w-4 text-white/60" />
            <Input
              placeholder="Rechercher un article, ELI ou mot-clé"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="border-0 bg-transparent text-white"
            />
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
            <Filter className="h-4 w-4" />
            <select
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value as typeof jurisdiction)}
              className="bg-transparent text-white focus:outline-none"
            >
              <option value="all">Toutes juridictions</option>
              <option value="FR">France</option>
              <option value="EU">Union européenne</option>
              <option value="OHADA">OHADA</option>
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
            <TableProperties className="h-4 w-4" />
            <select
              value={docType}
              onChange={(event) => setDocType(event.target.value as typeof docType)}
              className="bg-transparent text-white focus:outline-none"
            >
              <option value="all">Tous types</option>
              <option value="statute">Textes</option>
              <option value="regulation">Règlements</option>
              <option value="case">Jurisprudence</option>
              <option value="doctrine">Doctrine</option>
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr_300px]">
          <ScrollArea className="h-[520px] rounded-2xl border border-white/10 bg-white/5">
            <div className="space-y-1 p-3">
              {filteredResults.map((doc: CitationDocument) => (
                <button
                  key={doc.id}
                  onClick={() => selectDocument(doc)}
                  className={cn(
                    "w-full rounded-2xl border border-transparent px-3 py-2 text-left text-sm text-white/70 transition",
                    activeDocument?.id === doc.id && "border-cyan-400/40 bg-cyan-500/10 text-white"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white">{doc.title}</span>
                    <Badge variant="outline">{doc.jurisdiction}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-white/60">{typeLabels[doc.type]}</p>
                  <p className="mt-1 text-xs text-white/60">{doc.summary}</p>
                </button>
              ))}
              {!filteredResults.length ? (
                <p className="p-3 text-sm text-white/60">
                  Aucun résultat ne correspond à ces filtres.
                </p>
              ) : null}
              {activeDocument ? (
                <div className="mt-6 space-y-2 border-t border-white/10 pt-4">
                  <p className="text-xs uppercase tracking-wide text-white/60">Table des matières</p>
                  <DocumentToc
                    items={activeDocument.toc}
                    activeAnchor={activeAnchor}
                    onSelect={(anchor) => {
                      setActiveAnchor(anchor);
                      const target = document.getElementById(anchor);
                      if (target) {
                        target.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            {activeDocument ? (
              <Tabs
                value={activeAnchor ?? activeDocument.content[0]?.anchor ?? ""}
                onValueChange={setActiveAnchor}
                className="h-full"
              >
                <TabsList className="flex flex-wrap gap-2 rounded-2xl bg-white/10 p-2">
                  {activeDocument.content.map((section: CitationDocument["content"][number]) => (
                    <TabsTrigger key={section.anchor} value={section.anchor} className="rounded-xl px-3 py-2 text-sm text-white/80">
                      {section.heading}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollArea className="mt-4 h-[460px] pr-4">
                  {activeDocument.content.map((section: CitationDocument["content"][number]) => (
                    <TabsContent key={section.anchor} value={section.anchor} className="space-y-4">
                      <article
                        id={section.anchor}
                        className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-relaxed text-white/80"
                      >
                        <header className="flex items-center justify-between">
                          <h2 className="text-lg font-semibold text-white">{section.heading}</h2>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              telemetry.emit("citation_clicked", {
                                citationId: `${activeDocument.id}#${section.anchor}`,
                                context: "citation_browser"
                              });
                            }}
                          >
                            Copier la référence
                          </Button>
                        </header>
                        <p className="mt-3 whitespace-pre-line">{section.text}</p>
                      </article>
                    </TabsContent>
                  ))}
                </ScrollArea>
              </Tabs>
            ) : (
              <div className="h-full rounded-2xl border border-dashed border-white/20 p-6 text-white/60">
                Sélectionnez une citation pour afficher son contenu.
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {activeDocument ? (
              <div className="space-y-4">
                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <header className="flex items-center justify-between gap-2 text-sm font-semibold text-white">
                    <BookOpen className="h-4 w-4" /> Métadonnées
                  </header>
                  <div className="mt-3">
                    <MetadataGrid metadata={activeDocument.metadata} />
                  </div>
                </section>
                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <header className="flex items-center justify-between gap-2 text-sm font-semibold text-white">
                    <ArrowLeftRight className="h-4 w-4" /> Versions
                  </header>
                  <ul className="mt-3 space-y-2 text-sm text-white/70">
                    {activeDocument.versions.map((version: CitationDocument["versions"][number]) => (
                      <li key={version.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white">{version.label}</span>
                          {version.isConsolidated ? (
                            <Badge variant="secondary">Consolidée</Badge>
                          ) : (
                            <Badge variant="outline">Originale</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-white/60">{version.publishedAt}</p>
                        <p className="mt-2 text-sm text-white/70">{version.diffSummary}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2"
                          onClick={() =>
                            telemetry.emit("citation_clicked", {
                              citationId: `${activeDocument.id}:${version.id}`,
                              context: "citation_browser"
                            })
                          }
                        >
                          Voir la diff
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <header className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Link2 className="h-4 w-4" /> Actions
                  </header>
                  <div className="mt-3 space-y-2">
                    <Button className="w-full">
                      Ajouter à la preuve
                    </Button>
                    <Button variant="outline" className="w-full">
                      Ouvrir dans un nouvel onglet
                    </Button>
                  </div>
                </section>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
