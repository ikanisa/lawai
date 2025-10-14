import { queryOptions } from "@tanstack/react-query";

import { getCitationsBrowserData } from "@/lib/data/citations";

export function citationsBrowserQueryOptions() {
  return queryOptions({
    queryKey: ["citations", "browser"],
    queryFn: getCitationsBrowserData,
    staleTime: 120_000
  });
}
