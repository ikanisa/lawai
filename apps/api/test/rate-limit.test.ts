import { describe, expect, it, vi } from 'vitest';
import { InMemoryRateLimiter } from '../src/rate-limit';

describe('InMemoryRateLimiter', () => {
  it('allows hits up to the configured limit', async () => {
    const limiter = new InMemoryRateLimiter({ limit: 3, windowMs: 1_000 });

    const first = await limiter.hit('client');
    const second = await limiter.hit('client');
    const third = await limiter.hit('client');
    const fourth = await limiter.hit('client');

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(true);
    expect(fourth.allowed).toBe(false);
  });

  it('resets counters when reset() is called', async () => {
    const limiter = new InMemoryRateLimiter({ limit: 2, windowMs: 1_000 });

    await limiter.hit('ip');
    await limiter.hit('ip');
    await limiter.reset('ip');

    const next = await limiter.hit('ip');
    expect(next.allowed).toBe(true);
    expect(next.remaining).toBe(1);
  });

  it('blocks temporarily and releases after the timeout', async () => {
    vi.useFakeTimers();
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 10_000 });

    const blockPromise = limiter.block('wa-phone', 5_000);

    const duringBlock = await limiter.hit('wa-phone');
    expect(duringBlock.allowed).toBe(false);

    await vi.advanceTimersByTimeAsync(5_000);
    await blockPromise;

    const afterBlock = await limiter.hit('wa-phone');
    expect(afterBlock.allowed).toBe(true);

    vi.useRealTimers();
  });
});
