import { setTimeout as delay } from 'node:timers/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify';

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type Counter = {
  count: number;
  resetAt: number;
};

export class InMemoryRateLimiter {
  readonly limit: number;

  readonly windowMs: number;

  private readonly store = new Map<string, Counter>();

  constructor(options: RateLimiterOptions) {
    this.limit = Math.max(1, options.limit);
    this.windowMs = Math.max(1000, options.windowMs);
  }

  async hit(key: string): Promise<RateLimitResult> {
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

  async reset(key: string): Promise<void> {
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

interface RateLimiterDriver {
  readonly limit: number;
  readonly windowMs: number;
  hit(key: string): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
  block(key: string, durationMs: number): Promise<void>;
}

class MemoryDriver implements RateLimiterDriver {
  private readonly limiter: InMemoryRateLimiter;

  constructor(options: RateLimiterOptions) {
    this.limiter = new InMemoryRateLimiter(options);
  }

  get limit(): number {
    return this.limiter.limit;
  }

  get windowMs(): number {
    return this.limiter.windowMs;
  }

  async hit(key: string): Promise<RateLimitResult> {
    return this.limiter.hit(key);
  }

  async reset(key: string): Promise<void> {
    await this.limiter.reset(key);
  }

  async block(key: string, durationMs: number): Promise<void> {
    await this.limiter.block(key, durationMs);
  }
}

class SupabaseCounterDriver implements RateLimiterDriver {
  private readonly client: SupabaseClient;

  private readonly namespace: string;

  private readonly functionName: string;

  readonly limit: number;

  readonly windowMs: number;

  constructor(options: RateLimiterOptions, client: SupabaseClient, namespace: string, functionName: string) {
    this.limit = Math.max(1, options.limit);
    this.windowMs = Math.max(1000, options.windowMs);
    this.client = client;
    this.namespace = namespace;
    this.functionName = functionName;
  }

  async hit(key: string): Promise<RateLimitResult> {
    const identifier = `${this.namespace}:${key}`;
    const { data, error } = await this.client.rpc(this.functionName, {
      identifier,
      limit: this.limit,
      window_ms: this.windowMs,
    });

    if (error) {
      throw new Error(error.message ?? 'supabase_rate_limit_failed');
    }

    const payload = (data ?? {}) as {
      allowed?: unknown;
      remaining?: unknown;
      reset_at?: unknown;
      count?: unknown;
    };

    const resetValue = typeof payload.reset_at === 'string' ? Date.parse(payload.reset_at) : Number(payload.reset_at);
    const resetAt = Number.isFinite(resetValue) ? resetValue : Date.now() + this.windowMs;

    const countValue = typeof payload.count === 'number' ? payload.count : null;
    const allowed =
      typeof payload.allowed === 'boolean'
        ? payload.allowed
        : countValue !== null
          ? countValue <= this.limit
          : true;

    const remainingRaw = typeof payload.remaining === 'number' ? payload.remaining : null;
    const remaining = allowed
      ? remainingRaw !== null
        ? Math.max(0, remainingRaw)
        : countValue !== null
          ? Math.max(0, this.limit - countValue)
          : this.limit - 1
      : 0;

    return { allowed, remaining, resetAt };
  }

  async reset(_key: string): Promise<void> {
    // TTL-based stores eventually expire, so reset is a no-op for the remote driver.
  }

  async block(_key: string, _durationMs: number): Promise<void> {
    // Remote providers typically expose dedicated block primitives; fall back to local blocking.
  }
}

type RateLimiterLogger = Pick<FastifyBaseLogger, 'warn' | 'error'> | Console | undefined;

export class RateLimiter implements RateLimiterDriver {
  private readonly primary: RateLimiterDriver | null;

  private readonly fallback: RateLimiterDriver;

  private readonly logger: RateLimiterLogger;

  constructor(primary: RateLimiterDriver | null, fallback: RateLimiterDriver, logger?: RateLimiterLogger) {
    this.primary = primary;
    this.fallback = fallback;
    this.logger = logger;
  }

  get limit(): number {
    return this.primary?.limit ?? this.fallback.limit;
  }

  get windowMs(): number {
    return this.primary?.windowMs ?? this.fallback.windowMs;
  }

  async hit(key: string): Promise<RateLimitResult> {
    if (this.primary) {
      try {
        return await this.primary.hit(key);
      } catch (error) {
        this.logger?.warn?.({ err: error, key }, 'rate_limiter_primary_failed');
      }
    }
    return this.fallback.hit(key);
  }

  async reset(key: string): Promise<void> {
    if (this.primary) {
      try {
        await this.primary.reset(key);
        return;
      } catch (error) {
        this.logger?.warn?.({ err: error, key }, 'rate_limiter_primary_reset_failed');
      }
    }
    await this.fallback.reset(key);
  }

  async block(key: string, durationMs: number): Promise<void> {
    if (this.primary) {
      try {
        await this.primary.block(key, durationMs);
        return;
      } catch (error) {
        this.logger?.warn?.({ err: error, key }, 'rate_limiter_primary_block_failed');
      }
    }
    await this.fallback.block(key, durationMs);
  }
}

export interface RateLimiterFactoryConfig {
  driver: 'memory' | 'supabase';
  supabase?: SupabaseClient;
  namespace?: string;
  functionName?: string;
  logger?: RateLimiterLogger;
}

export type RateLimiterFactory = (options: RateLimiterOptions) => RateLimiter;

export function createRateLimiterFactory(config: RateLimiterFactoryConfig): RateLimiterFactory {
  const namespace = config.namespace ?? 'api';
  const functionName = config.functionName ?? 'increment_rate_limit';
  const logger = config.logger;

  return (options: RateLimiterOptions) => {
    const fallback = new MemoryDriver(options);
    const primary =
      config.driver === 'supabase' && config.supabase
        ? new SupabaseCounterDriver(options, config.supabase, namespace, functionName)
        : null;

    if (config.driver === 'supabase' && !primary) {
      logger?.warn?.({ driver: config.driver }, 'rate_limiter_primary_unavailable');
    }

    return new RateLimiter(primary, fallback, logger);
  };
}

export async function enforceRateLimit(
  limiter: RateLimiter,
  request: FastifyRequest,
  reply: FastifyReply,
  key: string,
): Promise<boolean> {
  try {
    const hit = await limiter.hit(key);
    reply.header('X-RateLimit-Limit', limiter.limit);
    reply.header('X-RateLimit-Remaining', Math.max(0, hit.remaining));
    reply.header('X-RateLimit-Reset', Math.ceil(hit.resetAt / 1000));

    if (!hit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000));
      reply.header('Retry-After', retryAfterSeconds);
      await reply.code(429).send({ error: 'rate_limit_exceeded' });
      return false;
    }
    return true;
  } catch (error) {
    request.log.warn({ err: error, key }, 'rate_limit_guard_failed');
    return true;
  }
}

