import { setTimeout as delay } from 'node:timers/promises';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

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

export interface RateLimitHit {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface SupabaseRateLimiterOptions {
  supabase: SupabaseClient;
  limit: number;
  windowSeconds: number;
  prefix?: string;
}

export class SupabaseRateLimiter {
  private readonly supabase: SupabaseClient;

  private readonly limit: number;

  private readonly windowSeconds: number;

  private readonly prefix?: string;

  constructor(options: SupabaseRateLimiterOptions) {
    this.supabase = options.supabase;
    this.limit = Math.max(1, options.limit);
    this.windowSeconds = Math.max(1, options.windowSeconds);
    this.prefix = options.prefix;
  }

  async hit(identifier: string, weight: number = 1): Promise<RateLimitHit> {
    const key = this.prefix ? `${this.prefix}:${identifier}` : identifier;
    const { data, error } = await this.supabase.rpc('rate_limit_hit', {
      identifier: key,
      limit: this.limit,
      window_seconds: this.windowSeconds,
      weight,
    });

    if (error) {
      const err = new Error('rate_limit_unavailable');
      (err as Error & { cause?: unknown }).cause = error;
      throw err;
    }

    const allowedRaw = data?.allowed;
    const remainingRaw = data?.remaining;
    const resetRaw = data?.reset_at;

    const allowed = typeof allowedRaw === 'boolean' ? allowedRaw : allowedRaw === 't' ? true : allowedRaw === 'f' ? false : true;
    let remaining: number;
    if (typeof remainingRaw === 'number') {
      remaining = remainingRaw;
    } else if (allowed) {
      remaining = Math.max(0, this.limit - weight);
    } else {
      remaining = 0;
    }

    const resetAt =
      typeof resetRaw === 'string'
        ? Date.parse(resetRaw)
        : typeof resetRaw === 'number'
          ? resetRaw
          : Date.now() + this.windowSeconds * 1000;

    return { allowed, remaining, resetAt };
  }
}

interface RateLimitPreHandlerOptions {
  limiter: SupabaseRateLimiter;
  keyGenerator: (request: FastifyRequest) => string | null;
  errorResponse?: (request: FastifyRequest) => unknown;
}

export function createRateLimitPreHandler(options: RateLimitPreHandlerOptions) {
  return async function rateLimitPreHandler(request: FastifyRequest, reply: FastifyReply) {
    const identifier = options.keyGenerator(request);
    if (!identifier) {
      return;
    }

    try {
      const hit = await options.limiter.hit(identifier);
      reply.header('x-rate-limit-remaining', String(Math.max(0, hit.remaining)));
      reply.header('x-rate-limit-reset', new Date(hit.resetAt).toISOString());

      if (!hit.allowed) {
        const retryAfter = Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000));
        reply.header('retry-after', String(retryAfter));
        return reply.code(429).send(options.errorResponse?.(request) ?? { error: 'rate_limit_exceeded' });
      }
    } catch (error) {
      request.log.warn({ err: error, identifier }, 'rate_limit_prehandler_failed');
    }
  };
}
