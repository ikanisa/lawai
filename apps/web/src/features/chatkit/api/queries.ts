import { queryOptions } from '@tanstack/react-query';

import {
  fetchChatkitSession,
  fetchChatkitSessions,
  type ChatkitSessionRecord,
  type ChatkitSessionStatus,
} from '@/lib/api';

export const chatkitKeys = {
  all: ['chatkit'] as const,
  sessions: (orgId: string) => [...chatkitKeys.all, 'sessions', orgId] as const,
  session: (sessionId: string) => [...chatkitKeys.all, 'session', sessionId] as const,
};

export const chatkitQueries = {
  sessions: (orgId: string, status?: ChatkitSessionStatus) =>
    queryOptions<ChatkitSessionRecord[]>({
      queryKey: status
        ? [...chatkitKeys.sessions(orgId), status]
        : chatkitKeys.sessions(orgId),
      queryFn: async () => {
        const response = await fetchChatkitSessions(orgId, status);
        return response.sessions;
      },
      staleTime: 10_000,
      refetchInterval: 30_000,
    }),
  session: (sessionId: string, includeSecret = false) =>
    queryOptions<ChatkitSessionRecord>({
      queryKey: includeSecret
        ? [...chatkitKeys.session(sessionId), 'with-secret']
        : chatkitKeys.session(sessionId),
      queryFn: () => fetchChatkitSession(sessionId, { includeSecret }),
      staleTime: 15_000,
    }),
};
