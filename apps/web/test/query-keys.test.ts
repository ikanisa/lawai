import { describe, expect, it } from 'vitest';

import { queryKeys } from '../src/lib/query';

describe('queryKeys', () => {
  it('generates stable corpus keys', () => {
    const first = queryKeys.corpus.all('org-1');
    const second = queryKeys.corpus.all('org-1');
    expect(first).toEqual(['corpus', 'org-1']);
    expect(first).toBeDefined();
    expect(first).not.toBe(second);
  });

  it('generates detailed keys with optional parts', () => {
    const detail = queryKeys.hitl.detail('org-1', 'audit', 'run-1', 'ticket-1');
    expect(detail).toEqual(['hitl', 'detail', 'org-1', 'audit', 'run-1', 'ticket-1']);
  });

  it('normalises compliance keys', () => {
    const compliance = queryKeys.compliance('org-2');
    expect(compliance).toEqual(['compliance', 'org-2']);
  });
});
