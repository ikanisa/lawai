import { apiFetch } from "@/lib/apiClient";
import type {
  HitlRiskLevel,
  HitlOutcome,
  HitlEvidenceReference,
  HitlIracBlock,
  HitlReviewItem,
  HitlQueueData
} from "@avocat-ai/shared";

export type {
  HitlRiskLevel,
  HitlOutcome,
  HitlEvidenceReference,
  HitlIracBlock,
  HitlReviewItem,
  HitlQueueData
} from "@avocat-ai/shared";

export async function getHitlQueueData(): Promise<HitlQueueData> {
  return apiFetch<HitlQueueData>({ path: "/api/hitl" });
}
