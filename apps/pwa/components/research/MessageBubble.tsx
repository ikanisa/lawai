import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ResearchCitation } from "@/lib/data/research";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ResearchCitation[];
  createdAt: number;
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
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
            <a
              key={citation.id}
              href={citation.href}
              target="_blank"
              rel="noreferrer noopener"
              className="focus-visible:outline-none"
            >
              <Badge className="rounded-full border-white/30 bg-white/5 text-[11px] text-white/80" variant="outline">
                {citation.label}
              </Badge>
            </a>
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
