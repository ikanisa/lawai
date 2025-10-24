import { setTimeout as delay } from 'node:timers/promises';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  prefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  hit(key: string): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
  block(key: string, durationMs: number): Promise<void>;
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly limit: number;

  public readonly windowMs: number;

  private readonly store = new Map<string, { count: number; resetAt: number }>();

  private readonly prefix: string;

  private readonly identifier?: string;

  constructor(options: RateLimiterOptions) {
    this.limit = Math.max(1, options.limit);
    this.windowMs = Math.max(1000, options.windowMs);
    this.prefix = options.prefix ?? 'memory';
  }

  private buildKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async hit(rawKey: string): Promise<RateLimitResult> {
    const key = this.buildKey(rawKey);
    const now = Date.now();
    const namespacedKey = this.applyNamespace(key);
    const counter = this.store.get(namespacedKey);

    if (!counter || counter.resetAt <= now) {
      const next = { count: 1, resetAt: now + this.windowMs };
      this.store.set(key, next);
      return { allowed: true, remaining: this.limit - 1, resetAt: next.resetAt };
    }

    if (counter.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: counter.resetAt };
    }

    counter.count += 1;
    return { allowed: true, remaining: Math.max(0, this.limit - counter.count), resetAt: counter.resetAt };
  }

  async reset(rawKey: string): Promise<void> {
    const key = this.buildKey(rawKey);
    this.store.delete(key);
  }

  async block(rawKey: string, durationMs: number): Promise<void> {
    const key = this.buildKey(rawKey);
    const until = Date.now() + durationMs;
    const namespacedKey = this.applyNamespace(key);
    this.store.set(namespacedKey, { count: this.limit, resetAt: until });
    await delay(durationMs);
    const counter = this.store.get(namespacedKey);
    if (counter && counter.resetAt === until) {
      this.store.delete(namespacedKey);
    }
  }

  private applyNamespace(key: string): string {
    if (!this.identifier) {
      return key;
    }
    return `${this.identifier}:${key}`;
  }
}

class RedisRateLimiter implements RateLimiter {
  public readonly limit: number;

  public readonly windowMs: number;

  private readonly client: Redis;

  private readonly keyPrefix: string;

  constructor(client: Redis, options: RateLimiterOptions) {
    this.client = client;
    this.limit = Math.max(1, options.limit);
    this.windowMs = Math.max(1000, options.windowMs);
    this.keyPrefix = options.identifier ? `rl:${options.identifier}:` : 'rl:';
  }

  async hit(key: string): Promise<RateLimitResult> {
    const redisKey = `${this.keyPrefix}${key}`;
    const count = await this.client.incr(redisKey);
    if (count === 1) {
      await this.client.pexpire(redisKey, this.windowMs);
    }
    let ttl = await this.client.pttl(redisKey);
    if (ttl < 0) {
      await this.client.pexpire(redisKey, this.windowMs);
      ttl = this.windowMs;
    }
    const allowed = count <= this.limit;
    const remaining = allowed ? Math.max(0, this.limit - count) : 0;
    const resetAt = Date.now() + (ttl > 0 ? ttl : this.windowMs);
    return { allowed, remaining, resetAt };
  }
}

class RedisRateLimiter implements RateLimiter {
  private readonly limit: number;

  private readonly windowMs: number;

  private readonly prefix: string;

  constructor(
    private readonly client: RedisClient,
    options: RateLimiterOptions,
    private readonly fallback: RateLimiter,
    private readonly logger?: Pick<Logger, 'warn' | 'error'>,
  ) {
    this.limit = Math.max(1, options.limit);
    this.windowMs = Math.max(1000, options.windowMs);
    this.prefix = options.prefix ?? 'redis';
  }

  private buildKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger?.warn({ err: error }, 'redis_rate_limit_failed');
      throw error;
    }
  }

  async hit(rawKey: string): Promise<RateLimitResult> {
    const key = this.buildKey(rawKey);
    try {
      const now = Date.now();
      const multi = this.client.multi();
      multi.incr(key);
      multi.pttl(key);
      multi.pexpire(key, this.windowMs, 'NX');
      const replies = await this.execute(() => multi.exec());

      if (!replies) {
        throw new Error('redis_multi_failed');
      }

      const incrReply = replies[0];
      if (!incrReply) {
        throw new Error('redis_incr_missing');
      }
      if (incrReply[0]) {
        throw incrReply[0];
      }
      const count = Number(incrReply[1] ?? 0);

      const ttlReply = replies[1];
      let ttlMs = Number(ttlReply?.[1] ?? -1);
      if (!Number.isFinite(ttlMs) || ttlMs < 0) {
        ttlMs = this.windowMs;
        await this.client.pexpire(key, this.windowMs);
      }

      const resetAt = now + ttlMs;
      const allowed = count <= this.limit;
      return { allowed, remaining: allowed ? Math.max(0, this.limit - count) : 0, resetAt };
    } catch (error) {
      this.logger?.warn({ err: error }, 'redis_rate_limit_fallback');
      return this.fallback.hit(rawKey);
    }
  }

  async reset(rawKey: string): Promise<void> {
    const key = this.buildKey(rawKey);
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger?.warn({ err: error }, 'redis_rate_limit_reset_failed');
      await this.fallback.reset(rawKey);
    }
  }

  async block(rawKey: string, durationMs: number): Promise<void> {
    const key = this.buildKey(rawKey);
    try {
      await this.client.set(key, String(this.limit), 'PX', durationMs);
    } catch (error) {
      this.logger?.warn({ err: error }, 'redis_rate_limit_block_failed');
      await this.fallback.block(rawKey, durationMs);
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
