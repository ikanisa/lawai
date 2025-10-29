import { useQuery } from '@tanstack/react-query';

import { fetchGovernanceMetrics, type GovernanceMetricsResponse } from '@/lib/api';

export function useGovernanceMetrics(orgId?: string, userId?: string, enabled = false) {
  return useQuery<GovernanceMetricsResponse>({
    queryKey: ['governance-metrics', orgId, userId],
    queryFn: () => {
      if (!orgId || !userId) {
        throw new Error('session_required');
      }
      return fetchGovernanceMetrics(orgId, { userId });
    },
    enabled,
    staleTime: 60_000,
  });
}
