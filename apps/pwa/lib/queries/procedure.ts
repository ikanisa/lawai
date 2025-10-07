import { queryOptions } from "@tanstack/react-query";

import { fetchProceduralNavigatorData } from "@/lib/data/procedure";

export const procedureKeys = {
  all: () => ["procedure"] as const,
  navigator: () => [...procedureKeys.all(), "navigator"] as const
};

export function proceduralNavigatorQueryOptions() {
  return queryOptions({
    queryKey: procedureKeys.navigator(),
    queryFn: fetchProceduralNavigatorData,
    staleTime: 1000 * 60
  });
}
