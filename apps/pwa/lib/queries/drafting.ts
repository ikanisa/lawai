import { queryOptions } from "@tanstack/react-query";

import { fetchDraftingStudioData } from "@/lib/data/drafting";

export const draftingKeys = {
  all: () => ["drafting"] as const,
  studio: () => [...draftingKeys.all(), "studio"] as const
};

export function draftingStudioQueryOptions() {
  return queryOptions({
    queryKey: draftingKeys.studio(),
    queryFn: fetchDraftingStudioData,
    staleTime: 1000 * 60
  });
}
