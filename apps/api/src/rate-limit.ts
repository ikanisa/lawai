import { setTimeout as delay } from 'node:timers/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type Redis from 'ioredis';

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  identifier?: string;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export interface RateLimiter {
  readonly limit: number;
  readonly windowMs: number;
  hit(key: string): Promise<RateLimitResult>;
  reset?(key: string): Promise<void> | void;
}

export interface BlockingRateLimiter extends RateLimiter {
  block?(key: string, durationMs: number): Promise<void>;
}

interface Counter {
  count: number;
  resetAt: number;
}

export type RateLimitLogger = {
  error?(details: unknown, message?: string): void;
  warn?(details: unknown, message?: string): void;
};

export class InMemoryRateLimiter implements BlockingRateLimiter {
  public readonly limit: number;

  public readonly windowMs: number;

  private readonly store = new Map<string, Counter>();

  private readonly identifier?: string;

  constructor(options: RateLimiterOptions) {
    this.limit = Math.max(1, options.limit);
    this.windowMs = Math.max(1000, options.windowMs);
    this.identifier = options.identifier;
  }

  async hit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const namespacedKey = this.applyNamespace(key);
    const counter = this.store.get(namespacedKey);

    if (!counter || counter.resetAt <= now) {
      const next: Counter = { count: 1, resetAt: now + this.windowMs };
      this.store.set(namespacedKey, next);
      return { allowed: true, remaining: this.limit - 1, resetAt: next.resetAt };
    }

    if (counter.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: counter.resetAt };
    }

    counter.count += 1;
    return { allowed: true, remaining: this.limit - counter.count, resetAt: counter.resetAt };
  }

  reset(key: string): void {
    this.store.delete(this.applyNamespace(key));
  }

  async block(key: string, durationMs: number): Promise<void> {
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

class SupabaseRateLimiter implements RateLimiter {
  public readonly limit: number;

  public readonly windowMs: number;

  private readonly client: SupabaseClient;

  private readonly functionName: string;

  private readonly identifier?: string;

  constructor(client: SupabaseClient, options: RateLimiterOptions & { functionName: string }) {
    this.client = client;
    this.limit = Math.max(1, options.limit);
    this.windowMs = Math.max(1000, options.windowMs);
    this.functionName = options.functionName;
    this.identifier = options.identifier;
  }

  async hit(key: string): Promise<RateLimitResult> {
    const response = await this.client.rpc(this.functionName, {
      key,
      limit: this.limit,
      window_ms: this.windowMs,
      identifier: this.identifier ?? null,
    });

    if (response.error) {
      throw response.error;
    }

    const payload = (response.data ?? {}) as {
      allowed?: boolean;
      remaining?: number;
      resetAt?: number;
      reset_at?: number | string;
    };

    const allowed = typeof payload.allowed === 'boolean' ? payload.allowed : true;
    const remaining = typeof payload.remaining === 'number' ? payload.remaining : this.limit - 1;
    const resetAtCandidate =
      typeof payload.resetAt === 'number'
        ? payload.resetAt
        : typeof payload.reset_at === 'number'
          ? payload.reset_at
          : typeof payload.reset_at === 'string'
            ? Date.parse(payload.reset_at)
            : Date.now() + this.windowMs;

    return {
      allowed,
      remaining: Math.max(0, remaining),
      resetAt: Number.isFinite(resetAtCandidate) ? resetAtCandidate : Date.now() + this.windowMs,
    };
  }
}

export type RateLimiterProvider = 'memory' | 'redis' | 'supabase';

export interface RateLimiterFactoryConfig {
  provider: RateLimiterProvider;
  redisClient?: Redis;
  supabase?: SupabaseClient;
  supabaseFunction?: string;
  logger?: RateLimitLogger;
}

export async function createRateLimiter(
  options: RateLimiterOptions,
  config: RateLimiterFactoryConfig,
): Promise<RateLimiter> {
  const provider = config.provider ?? 'memory';
  if (provider === 'redis') {
    if (config.redisClient) {
      return new RedisRateLimiter(config.redisClient, options);
    }
    config.logger?.warn?.({ provider }, 'rate_limit_provider_missing_client');
  } else if (provider === 'supabase') {
    if (config.supabase) {
      const fnName = config.supabaseFunction && config.supabaseFunction.trim().length > 0
        ? config.supabaseFunction
        : 'enforce_rate_limit';
      return new SupabaseRateLimiter(config.supabase, { ...options, functionName: fnName });
    }
    config.logger?.warn?.({ provider }, 'rate_limit_provider_missing_client');
  }

  return new InMemoryRateLimiter(options);
}

export type FastifyRateLimitHook = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export interface RateLimitGuardOptions {
  keyGenerator: (request: FastifyRequest) => string | null | undefined;
  identifier?: string;
  logger?: RateLimitLogger;
}

export function createRateLimitGuard(
  limiter: RateLimiter,
  options: RateLimitGuardOptions,
): FastifyRateLimitHook {
  const logger = options.logger;
  return async (request, reply) => {
    const key = options.keyGenerator(request);
    if (!key) {
      return;
    }

    let result: RateLimitResult;
    try {
      result = await limiter.hit(key);
    } catch (error) {
      logger?.error?.({ err: error, identifier: options.identifier }, 'rate_limit_hit_failed');
      return;
    }

    reply.header('x-ratelimit-limit', limiter.limit);
    reply.header('x-ratelimit-remaining', Math.max(0, result.remaining));
    reply.header('x-ratelimit-reset', Math.ceil(result.resetAt / 1000));

    if (result.allowed) {
      return;
    }

    const retryAfterSeconds = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000));
    reply.header('retry-after', retryAfterSeconds);
    logger?.warn?.({ identifier: options.identifier, key }, 'rate_limit_exhausted');
    await reply.code(429).send({
      error: 'rate_limit_exceeded',
      limit: limiter.limit,
      resetAt: new Date(result.resetAt).toISOString(),
    });
  };
}
