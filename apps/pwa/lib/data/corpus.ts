import { apiFetch } from "@/lib/apiClient";
import type {
  AllowlistSource,
  CorpusDashboardData,
  IntegrationStatus,
  SnapshotEntry,
  IngestionJob,
  PolicyConfiguration
} from "@avocat-ai/shared";

export type {
  AllowlistSource,
  CorpusDashboardData,
  IntegrationStatus,
  SnapshotEntry,
  IngestionJob,
  PolicyConfiguration
} from "@avocat-ai/shared";

export interface CorpusDashboardResponse extends CorpusDashboardData {
  policies: PolicyConfiguration;
}

export async function getCorpusDashboardData(): Promise<CorpusDashboardResponse> {
  return apiFetch<CorpusDashboardResponse>({ path: "/api/corpus" });
}
