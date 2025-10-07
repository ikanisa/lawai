import { queryOptions } from "@tanstack/react-query";

import { getHitlQueueData } from "@/lib/data/hitl";

export function hitlQueueQueryOptions() {
  return queryOptions({
    queryKey: ["hitl", "queue"],
    queryFn: getHitlQueueData,
    staleTime: 45_000
  });
}
