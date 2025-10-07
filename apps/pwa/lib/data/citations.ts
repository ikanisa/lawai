import { apiFetch } from "@/lib/apiClient";
import type { CitationsBrowserData, CitationDocument } from "@avocat-ai/shared";

export type { CitationDocument, CitationsBrowserData } from "@avocat-ai/shared";

export async function getCitationsBrowserData(): Promise<CitationsBrowserData> {
  return apiFetch<CitationsBrowserData>({ path: "/api/citations" });
}
