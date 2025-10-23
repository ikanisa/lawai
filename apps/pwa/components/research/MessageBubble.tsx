import Link from "next/link";

import { type ResearchCitation } from "@/lib/data/research";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ResearchCitation[];
  createdAt: number;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onCitationClick?: (citation: ResearchCitation) => void;
}

export function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
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
          {message.citations.map((citation) => (
            <Link
              key={citation.id}
              href={citation.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/30 bg-white/5 px-3 py-1 text-[11px] text-white/80 transition hover:border-white/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              onClick={() => onCitationClick?.(citation)}
            >
              {citation.label}
            </Link>
          ))}
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
