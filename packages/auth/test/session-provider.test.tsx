import { afterEach, describe, expect, it } from 'vitest';

import {
  __resetSessionStateForTests,
  __setSessionStateForTests,
  getCachedSession,
  getCachedSessionStatus,
  type SessionValue,
  waitForSession,
} from '../src/index.js';

describe('session state helpers', () => {
  afterEach(() => {
    __resetSessionStateForTests();
  });

  it('tracks cached session state', () => {
    const value: SessionValue = { orgId: 'org', userId: 'user' };
    __setSessionStateForTests(value, 'authenticated');
    expect(getCachedSession()).toEqual(value);
    expect(getCachedSessionStatus()).toBe('authenticated');
  });

  it('resolves waiters when the session becomes available', async () => {
    const promise = waitForSession();
    __setSessionStateForTests({ orgId: 'demo', userId: 'user' }, 'authenticated');
    await expect(promise).resolves.toEqual({ orgId: 'demo', userId: 'user' });
  });
});
