import { queryOptions } from "@tanstack/react-query";

import { fetchResearchDeskContext } from "@/lib/data/research";

export const researchKeys = {
  all: () => ["research"] as const,
  context: () => [...researchKeys.all(), "context"] as const
};

export function researchDeskContextQueryOptions() {
  return queryOptions({
    queryKey: researchKeys.context(),
    queryFn: fetchResearchDeskContext,
    staleTime: 1000 * 60
  });
}
