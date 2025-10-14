import { queryOptions } from "@tanstack/react-query";

import { getMattersOverview } from "@/lib/data/matters";

export function mattersOverviewQueryOptions() {
  return queryOptions({
    queryKey: ["matters", "overview"],
    queryFn: getMattersOverview,
    staleTime: 60_000
  });
}
