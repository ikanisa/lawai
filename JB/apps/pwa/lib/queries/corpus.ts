import { queryOptions } from "@tanstack/react-query";

import { getCorpusDashboardData } from "@/lib/data/corpus";

export function corpusDashboardQueryOptions() {
  return queryOptions({
    queryKey: ["corpus", "dashboard"],
    queryFn: getCorpusDashboardData,
    staleTime: 90_000
  });
}
