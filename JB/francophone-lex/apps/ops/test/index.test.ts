import { describe, expect, it } from 'vitest';
import { OFFICIAL_DOMAIN_ALLOWLIST } from '@avocat-ai/shared';

describe('ops shared imports', () => {
  it('exposes allowlist domains', () => {
    expect(OFFICIAL_DOMAIN_ALLOWLIST.length).toBeGreaterThan(0);
  });
});
