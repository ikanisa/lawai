'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import type { Locale } from '@/lib/i18n';

import { workspaceQueries } from '../api/queries';

export function useWorkspaceOverview(locale: Locale) {
  return useSuspenseQuery(workspaceQueries.overview(locale));
}
