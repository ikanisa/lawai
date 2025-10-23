import { queryOptions } from '@tanstack/react-query';

import { DEMO_ORG_ID, fetchWorkspaceOverview, type WorkspaceOverviewResponse } from '@/lib/api';
import type { Locale } from '@/lib/i18n';

export const workspaceKeys = {
  all: ['workspace'] as const,
  overview: (locale: Locale) => [...workspaceKeys.all, 'overview', locale] as const,
};

export const workspaceQueries = {
  overview: (locale: Locale) =>
    queryOptions<WorkspaceOverviewResponse>({
      queryKey: workspaceKeys.overview(locale),
      queryFn: () => fetchWorkspaceOverview(DEMO_ORG_ID),
      staleTime: 1000 * 60 * 5,
    }),
};
