import type { ResearchCitation } from "@/lib/data/research";

export type ToolLogStatus = "running" | "success" | "error";

export interface ToolLogEntry {
  id: string;
  name: string;
  status: ToolLogStatus;
  detail: string;
  startedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ResearchCitation[];
  createdAt: number;
}
