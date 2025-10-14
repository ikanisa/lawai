"use client";

import Link from "next/link";
import { ExternalLink, Stars } from "lucide-react";

import type { ResearchCitation } from "@/lib/data/research";
import { cn } from "@/lib/utils";

interface EvidencePaneProps {
  citations: ResearchCitation[];
  onCitationClick?: (citation: ResearchCitation) => void;
}

export function EvidencePane({ citations, onCitationClick }: EvidencePaneProps) {
  return (
    <aside
      aria-label="Preuves et citations"
      className="glass-surface flex h-full flex-col rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[var(--shadow-z2)] backdrop-blur-2xl"
    >
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/80">Citations</h2>
          <p className="text-xs text-white/60">Sources officielles et jurisprudence associée</p>
        </div>
        <Stars className="h-4 w-4 text-sky-200" aria-hidden />
      </header>
      <div className="mt-4 space-y-3 overflow-y-auto pr-1">
        {citations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Les références citées par l’agent apparaîtront ici.
          </p>
        ) : (
          citations.map((citation) => (
            <article
              key={citation.id}
              className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{citation.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-white/60">{citation.type}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70",
                    citation.score >= 90 && "bg-emerald-500/20 text-emerald-100",
                    citation.score < 75 && "bg-amber-500/20 text-amber-100"
                  )}
                >
                  {citation.score}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/70">{citation.snippet}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                <span>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(citation.date))}</span>
                <Link
                  href={citation.href}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
                  onClick={() => onCitationClick?.(citation)}
                >
                  Consulter
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
