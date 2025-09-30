import { setTimeout as delay } from 'node:timers/promises';

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
}

type Counter = {
  count: number;
  resetAt: number;
};

export class InMemoryRateLimiter {
  private readonly limit: number;

  private readonly windowMs: number;

  private readonly store = new Map<string, Counter>();

  constructor(options: RateLimiterOptions) {
    this.limit = Math.max(1, options.limit);
    this.windowMs = Math.max(1000, options.windowMs);
  }

  hit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const counter = this.store.get(key);

    if (!counter || counter.resetAt <= now) {
      const next: Counter = { count: 1, resetAt: now + this.windowMs };
      this.store.set(key, next);
      return { allowed: true, remaining: this.limit - 1, resetAt: next.resetAt };
    }

    if (counter.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: counter.resetAt };
    }

    counter.count += 1;
    return { allowed: true, remaining: this.limit - counter.count, resetAt: counter.resetAt };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  async block(key: string, durationMs: number): Promise<void> {
    const until = Date.now() + durationMs;
    this.store.set(key, { count: this.limit, resetAt: until });
    await delay(durationMs);
    const counter = this.store.get(key);
    if (counter && counter.resetAt === until) {
      this.store.delete(key);
    }
  }
}

