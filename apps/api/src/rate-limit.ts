import { setTimeout as delay } from 'node:timers/promises';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import IORedis, { type Redis as RedisClient } from 'ioredis';
import type { Logger } from 'pino';

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

class SupabaseRateLimiter implements RateLimiter {
  private readonly limit: number;

  private readonly windowMs: number;

  private readonly prefix: string;

  constructor(
    private readonly client: SupabaseClient,
    options: RateLimiterOptions,
    private readonly fallback: RateLimiter,
    private readonly functionName = 'acquire_rate_limit',
    private readonly logger?: Pick<Logger, 'warn' | 'error'>,
  ) {
    this.limit = Math.max(1, options.limit);
    this.windowMs = Math.max(1000, options.windowMs);
    this.prefix = options.prefix ?? 'supabase';
  }

  private buildKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private normaliseResetAt(resetAt: unknown): number {
    if (typeof resetAt === 'number' && Number.isFinite(resetAt)) {
      return resetAt;
    }
    if (typeof resetAt === 'string') {
      const parsed = Date.parse(resetAt);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return Date.now() + this.windowMs;
  }

  async hit(rawKey: string): Promise<RateLimitResult> {
    const key = this.buildKey(rawKey);
    try {
      const { data, error } = await this.client.rpc(this.functionName, {
        key,
        limit: this.limit,
        window_ms: this.windowMs,
      });

      if (error) {
        throw error;
      }

      const payload = Array.isArray(data) ? (data[0] as Record<string, unknown> | null) : (data as Record<string, unknown> | null);
      if (!payload || typeof payload.allowed !== 'boolean') {
        return this.fallback.hit(rawKey);
      }

      const remainingRaw = Number(payload.remaining ?? 0);
      const remaining = Number.isFinite(remainingRaw) ? Math.max(0, remainingRaw) : 0;
      const resetAt = this.normaliseResetAt(payload.reset_at ?? payload.resetAt);
      return { allowed: Boolean(payload.allowed), remaining, resetAt };
    } catch (error) {
      this.logger?.warn({ err: error }, 'supabase_rate_limit_fallback');
      return this.fallback.hit(rawKey);
    }
  }

  async reset(rawKey: string): Promise<void> {
    await this.fallback.reset(rawKey);
  }

  async block(rawKey: string, durationMs: number): Promise<void> {
    await this.fallback.block(rawKey, durationMs);
  }
}

export type RateLimiterBackend = 'memory' | 'redis' | 'supabase';

export interface RateLimiterFactoryConfig {
  enabled: boolean;
  provider: RateLimiterBackend;
  redis?: {
    url?: string;
    client?: RedisClient;
  };
  supabase?: {
    client?: SupabaseClient;
    functionName?: string;
  };
  logger?: Pick<Logger, 'warn' | 'error'>;
}

export interface RateLimiterFactory {
  create(scope: string, options: RateLimiterOptions): RateLimiter | null;
}

export function createRateLimiterFactory(config: RateLimiterFactoryConfig): RateLimiterFactory {
  let redisClient = config.redis?.client ?? null;

  return {
    create(scope: string, options: RateLimiterOptions): RateLimiter | null {
      if (!config.enabled) {
        return null;
      }

      const sanitised: RateLimiterOptions = {
        limit: Math.max(1, options.limit),
        windowMs: Math.max(1000, options.windowMs),
        prefix: options.prefix ?? `rl:${scope}`,
      };
      const fallback = new InMemoryRateLimiter(sanitised);

      switch (config.provider) {
        case 'redis': {
          try {
            if (!redisClient && config.redis?.url) {
              redisClient = new IORedis(config.redis.url, {
                lazyConnect: true,
                maxRetriesPerRequest: 1,
                enableOfflineQueue: false,
              });
            }

            if (redisClient) {
              return new RedisRateLimiter(redisClient, sanitised, fallback, config.logger);
            }

            config.logger?.warn({ scope }, 'redis_rate_limit_client_unavailable');
          } catch (error) {
            config.logger?.error?.({ err: error }, 'redis_rate_limit_init_failed');
          }
          return fallback;
        }
        case 'supabase': {
          if (config.supabase?.client) {
            return new SupabaseRateLimiter(
              config.supabase.client,
              sanitised,
              fallback,
              config.supabase.functionName,
              config.logger,
            );
          }
          config.logger?.warn({ scope }, 'supabase_rate_limit_client_unavailable');
          return fallback;
        }
        case 'memory':
        default:
          return fallback;
      }
    },
  };
}

export type RateLimitKeyPart = string | number | boolean | null | undefined;

export interface RateLimitGuardOptions {
  name: string;
  limit: number;
  windowMs: number;
  logger?: Pick<Logger, 'warn' | 'error'>;
}

export type RateLimitGuard = (
  request: FastifyRequest,
  reply: FastifyReply,
  keyParts: RateLimitKeyPart[],
) => Promise<boolean>;

export function createRateLimitGuard(
  limiter: RateLimiter | null,
  options: RateLimitGuardOptions,
): RateLimitGuard {
  const limit = Math.max(1, options.limit);
  const windowMs = Math.max(1000, options.windowMs);

  if (!limiter) {
    return async () => false;
  }

  return async (request, reply, keyParts) => {
    const key = keyParts
      .map((part) => (part === undefined || part === null ? 'unknown' : String(part)))
      .join(':') || 'global';

    try {
      const result = await limiter.hit(key);
      reply.header('X-RateLimit-Limit', String(limit));
      reply.header('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
      reply.header('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
      reply.header('X-RateLimit-Window', String(windowMs));
      reply.header('X-RateLimit-Scope', options.name);

      if (!result.allowed) {
        const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
        reply.header('Retry-After', String(retryAfter));
        options.logger?.warn?.({ scope: options.name, key }, 'rate_limit_exceeded');
        await reply.code(429).send({ error: 'rate_limited', scope: options.name });
        return true;
      }
    } catch (error) {
      options.logger?.error?.({ err: error, scope: options.name, key }, 'rate_limit_guard_failed');
    }

    return false;
  };
}
