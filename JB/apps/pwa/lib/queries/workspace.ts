import { queryOptions } from "@tanstack/react-query";

import { fetchWorkspaceOverview } from "@/lib/data/workspace";

export const workspaceKeys = {
  all: () => ["workspace"] as const,
  overview: () => [...workspaceKeys.all(), "overview"] as const
};

export function workspaceOverviewQueryOptions() {
  return queryOptions({
    queryKey: workspaceKeys.overview(),
    queryFn: fetchWorkspaceOverview,
    staleTime: 1000 * 60
  });
}
