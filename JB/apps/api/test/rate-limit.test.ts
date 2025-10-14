import { describe, expect, it, vi } from 'vitest';
import { InMemoryRateLimiter } from '../src/rate-limit';

describe('InMemoryRateLimiter', () => {
  it('allows hits up to the configured limit', () => {
    const limiter = new InMemoryRateLimiter({ limit: 3, windowMs: 1_000 });

    const first = limiter.hit('client');
    const second = limiter.hit('client');
    const third = limiter.hit('client');
    const fourth = limiter.hit('client');

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(true);
    expect(fourth.allowed).toBe(false);
  });

  it('resets counters when reset() is called', () => {
    const limiter = new InMemoryRateLimiter({ limit: 2, windowMs: 1_000 });

    limiter.hit('ip');
    limiter.hit('ip');
    limiter.reset('ip');

    const next = limiter.hit('ip');
    expect(next.allowed).toBe(true);
    expect(next.remaining).toBe(1);
  });

  it('blocks temporarily and releases after the timeout', async () => {
    vi.useFakeTimers();
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 10_000 });

    const blockPromise = limiter.block('wa-phone', 5_000);

    const duringBlock = limiter.hit('wa-phone');
    expect(duringBlock.allowed).toBe(false);

    await vi.advanceTimersByTimeAsync(5_000);
    await blockPromise;

    const afterBlock = limiter.hit('wa-phone');
    expect(afterBlock.allowed).toBe(true);

    vi.useRealTimers();
  });
});
