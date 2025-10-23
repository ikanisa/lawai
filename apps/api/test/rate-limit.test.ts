import { describe, expect, it, vi } from 'vitest';
import { InMemoryRateLimiter, RateLimiter, type RateLimitResult, enforceRateLimit } from '../src/rate-limit';
import type { FastifyReply, FastifyRequest } from 'fastify';

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

describe('RateLimiter fallback behaviour', () => {
  it('falls back to the in-memory driver when the primary throws', async () => {
    const now = Date.now();
    const primary = {
      limit: 5,
      windowMs: 1000,
      hit: vi.fn<(key: string) => Promise<RateLimitResult>>()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue({
          allowed: true,
          remaining: 4,
          resetAt: now + 1000,
        }),
      reset: vi.fn<(key: string) => Promise<void>>().mockRejectedValue(new Error('fail')),
      block: vi.fn<(key: string, ms: number) => Promise<void>>().mockRejectedValue(new Error('fail')),
    };

    const fallbackLimiter = new InMemoryRateLimiter({ limit: 5, windowMs: 1000 });
    const fallback = {
      get limit() {
        return fallbackLimiter.limit;
      },
      get windowMs() {
        return fallbackLimiter.windowMs;
      },
      hit: vi.fn<(key: string) => Promise<RateLimitResult>>((key: string) => fallbackLimiter.hit(key)),
      reset: vi.fn<(key: string) => Promise<void>>((key: string) => fallbackLimiter.reset(key)),
      block: vi.fn<(key: string, ms: number) => Promise<void>>((key: string, ms: number) => fallbackLimiter.block(key, ms)),
    } satisfies {
      readonly limit: number;
      readonly windowMs: number;
      hit: (key: string) => Promise<RateLimitResult>;
      reset: (key: string) => Promise<void>;
      block: (key: string, ms: number) => Promise<void>;
    };

    const warn = vi.fn();
    const limiter = new RateLimiter(primary as never, fallback, { warn });

    const first = await limiter.hit('client');
    expect(first.allowed).toBe(true);
    expect(primary.hit).toHaveBeenCalledTimes(1);
    expect(fallback.hit).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith({ err: expect.any(Error), key: 'client' }, 'rate_limiter_primary_failed');

    await limiter.reset('client');
    expect(fallback.reset).toHaveBeenCalled();

    await limiter.block('client', 10);
    expect(fallback.block).toHaveBeenCalled();
  });
});

describe('enforceRateLimit', () => {
  it('sets headers and returns true when allowed', async () => {
    const limiter = new InMemoryRateLimiter({ limit: 3, windowMs: 1000 });
    const driver = {
      limit: limiter.limit,
      windowMs: limiter.windowMs,
      hit: (key: string) => limiter.hit(key),
      reset: (key: string) => limiter.reset(key),
      block: (key: string, ms: number) => limiter.block(key, ms),
    } satisfies {
      limit: number;
      windowMs: number;
      hit: (key: string) => Promise<RateLimitResult>;
      reset: (key: string) => Promise<void>;
      block: (key: string, ms: number) => Promise<void>;
    };
    const wrappedLimiter = new RateLimiter(null, driver);
    const request = { log: { warn: vi.fn() } } as unknown as FastifyRequest;
    const reply = {
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue(undefined),
    } as unknown as FastifyReply;

    const allowed = await enforceRateLimit(wrappedLimiter, request, reply, 'client');

    expect(allowed).toBe(true);
    expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Limit', limiter.limit);
    expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    expect(reply.code).not.toHaveBeenCalledWith(429);
  });

  it('returns false and sends 429 when exhausted', async () => {
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 1000 });
    const driver = {
      limit: limiter.limit,
      windowMs: limiter.windowMs,
      hit: (key: string) => limiter.hit(key),
      reset: (key: string) => limiter.reset(key),
      block: (key: string, ms: number) => limiter.block(key, ms),
    } satisfies {
      limit: number;
      windowMs: number;
      hit: (key: string) => Promise<RateLimitResult>;
      reset: (key: string) => Promise<void>;
      block: (key: string, ms: number) => Promise<void>;
    };
    const wrappedLimiter = new RateLimiter(null, driver);
    await wrappedLimiter.hit('client');

    const request = { log: { warn: vi.fn() } } as unknown as FastifyRequest;
    const reply = {
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue(undefined),
    } as unknown as FastifyReply;

    const allowed = await enforceRateLimit(wrappedLimiter, request, reply, 'client');

    expect(allowed).toBe(false);
    expect(reply.code).toHaveBeenCalledWith(429);
    expect(reply.send).toHaveBeenCalledWith({ error: 'rate_limit_exceeded' });
  });
});
