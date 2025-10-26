"use client";

import Link from "next/link";

import type { ResearchCitation } from "@/lib/data/research";
import { cn } from "@/lib/utils";

import type { ChatMessage } from "@/lib/research/types";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <article
      className={cn(
        "rounded-3xl border border-white/10 p-4 shadow-[0_10px_30px_rgba(2,6,23,0.35)] transition",
        isAssistant ? "bg-white/10 text-white" : "bg-[#0B1220]/80 text-white/80"
      )}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
        <span>{isAssistant ? "Agent" : "Vous"}</span>
        <time dateTime={new Date(message.createdAt).toISOString()}>{formatTime(message.createdAt)}</time>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/90">{message.content}</p>
      {message.citations.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.citations.map((citation: ResearchCitation) => {
            const formattedDate = new Intl.DateTimeFormat("fr-FR", {
              dateStyle: "medium"
            }).format(new Date(citation.date));
            const screenReaderLabel = `Consulter ${citation.type} publié le ${formattedDate} : ${citation.label}`;
            return (
              <Link
                key={citation.id}
                href={citation.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-white/30 bg-white/5 px-3 py-1 text-[11px] text-white/80 transition hover:border-white/50 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
                aria-label={screenReaderLabel}
              >
                <span aria-hidden>{citation.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}
