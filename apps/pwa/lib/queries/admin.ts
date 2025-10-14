import { queryOptions } from "@tanstack/react-query";

import { getAdminConsoleData } from "@/lib/data/admin";

export function adminConsoleQueryOptions() {
  return queryOptions({
    queryKey: ["admin", "console"],
    queryFn: getAdminConsoleData,
    staleTime: 180_000
  });
}
