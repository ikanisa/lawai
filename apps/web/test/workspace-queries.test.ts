import { describe, expect, it } from 'vitest';

import { workspaceKeys, workspaceQueries } from '@/features/workspace/api/queries';

describe('workspaceQueries', () => {
  it('creates stable overview query keys', () => {
    expect(workspaceKeys.overview('fr')).toEqual(['workspace', 'overview', 'fr']);
  });

  it('exposes overview query options', () => {
    const query = workspaceQueries.overview('en');
    expect(query.queryKey).toEqual(['workspace', 'overview', 'en']);
    expect(typeof query.queryFn).toBe('function');
    expect(query.staleTime).toBe(1000 * 60 * 5);
  });
});
