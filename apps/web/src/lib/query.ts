import { QueryClient } from '@tanstack/react-query';

type OrgScopedKey = readonly [string, string, ...(string | number | boolean | null | undefined)[]];

type KeyFactory<TPrefix extends string> = {
  all: () => readonly [TPrefix];
  detail: (
    id: string | number,
    ...parts: Array<string | number | boolean | null | undefined>
  ) => readonly [TPrefix, 'detail', string | number, ...Array<string | number | boolean | null | undefined>];
  list: (
    ...parts: Array<string | number | boolean | null | undefined>
  ) => readonly [TPrefix, 'list', ...Array<string | number | boolean | null | undefined>];
};

function createKeyFactory<TPrefix extends string>(prefix: TPrefix): KeyFactory<TPrefix> {
  return {
    all: () => [prefix],
    detail: (id, ...parts) => [prefix, 'detail', id, ...parts],
    list: (...parts) => [prefix, 'list', ...parts],
  } as const satisfies KeyFactory<TPrefix>;
}

export const queryKeys = {
  corpus: {
    all: (orgId: string): OrgScopedKey => ['corpus', orgId],
    snapshots: (orgId: string) => ['corpus', orgId, 'snapshots'] as const,
  },
  citations: createKeyFactory('citations'),
  drafting: createKeyFactory('drafting'),
  matters: createKeyFactory('matters'),
  hitl: createKeyFactory('hitl'),
  trust: createKeyFactory('trust'),
  research: {
    history: () => ['research', 'history'] as const,
  },
  compliance: (orgId: string) => ['compliance', orgId] as const,
} as const;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
          if (failureCount > 2) return false;
          if (typeof window !== 'undefined' && !window.navigator.onLine) {
            return false;
          }
          return true;
        },
        suspense: true,
        throwOnError: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        onError: (error) => {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[query] mutation error', error);
          }
        },
      },
    },
  });
}
