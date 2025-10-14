import { apiFetch } from "@/lib/apiClient";
import type {
  MatterRiskLevel,
  MatterTimelineEvent,
  MatterDeadlineEntry,
  MatterDocumentNode,
  MatterSummary,
  MattersOverview
} from "@avocat-ai/shared";

export type {
  MatterRiskLevel,
  MatterTimelineEvent,
  MatterDeadlineEntry,
  MatterDocumentNode,
  MatterSummary,
  MattersOverview
} from "@avocat-ai/shared";

export async function getMattersOverview(): Promise<MattersOverview> {
  return apiFetch<MattersOverview>({ path: "/api/matters" });
}
