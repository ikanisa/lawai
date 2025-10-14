import { queryOptions } from "@tanstack/react-query";
import type { VoiceConsoleContext, VoiceRunRequest, VoiceRunResponse } from "@avocat-ai/shared";

import { apiFetch } from "@/lib/apiClient";

export const voiceConsoleContextQueryOptions = () =>
  queryOptions({
    queryKey: ["voice", "context"],
    queryFn: () => apiFetch<VoiceConsoleContext>({ path: "/api/voice/context" }),
    staleTime: 60 * 1000,
  });

export async function submitVoiceRun(body: VoiceRunRequest): Promise<VoiceRunResponse> {
  return apiFetch<VoiceRunResponse, VoiceRunRequest>({
    path: "/api/voice/run",
    method: "POST",
    body,
  });
}
