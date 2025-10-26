import { useQuery } from '@tanstack/react-query';

import { DEMO_ORG_ID, fetchGovernanceMetrics, type GovernanceMetricsResponse } from '@/lib/api';

export function useGovernanceMetrics() {
  return useQuery<GovernanceMetricsResponse>({
    queryKey: ['governance-metrics', DEMO_ORG_ID],
    queryFn: () => fetchGovernanceMetrics(DEMO_ORG_ID),
    staleTime: 60_000,
  });
}
