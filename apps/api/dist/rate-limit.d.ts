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
export declare class InMemoryRateLimiter implements RateLimiter {
    private readonly limit;
    readonly windowMs: number;
    private readonly store;
    private readonly prefix;
    private readonly identifier?;
    constructor(options: RateLimiterOptions);
    private buildKey;
    hit(rawKey: string): Promise<RateLimitResult>;
    reset(rawKey: string): Promise<void>;
    block(rawKey: string, durationMs: number): Promise<void>;
    private applyNamespace;
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
export declare class SupabaseRateLimiter {
    private readonly supabase;
    private readonly limit;
    private readonly windowSeconds;
    private readonly prefix?;
    constructor(options: SupabaseRateLimiterOptions);
    hit(identifier: string, weight?: number): Promise<RateLimitHit>;
}
interface RateLimitPreHandlerOptions {
    limiter: SupabaseRateLimiter;
    keyGenerator: (request: FastifyRequest) => string | null;
    errorResponse?: (request: FastifyRequest) => unknown;
}
export declare function createRateLimitPreHandler(options: RateLimitPreHandlerOptions): (request: FastifyRequest, reply: FastifyReply) => Promise<undefined>;
interface RateLimiterFactoryConfig {
    enabled?: boolean;
    provider?: 'memory' | 'redis' | 'supabase';
    driver?: 'memory' | 'redis' | 'supabase';
    redis?: {
        client?: unknown;
    };
    supabase?: {
        client: SupabaseClient;
        functionName?: string;
    };
    logger?: {
        warn?: (info: unknown, msg?: string) => void;
    };
}
export interface RateLimiterFactory {
    create(name: string, options: RateLimiterOptions): RateLimiter;
}
export declare function createRateLimiterFactory(config: RateLimiterFactoryConfig): RateLimiterFactory;
export type RateLimitGuard = (request: FastifyRequest, reply: FastifyReply, extraKeyParts?: unknown[]) => Promise<boolean>;
interface RateLimitGuardOptions {
    name?: string;
    keyGenerator?: (request: FastifyRequest, extraKeyParts?: unknown[]) => string | null;
    errorResponse?: (request: FastifyRequest) => unknown;
}
export declare function createRateLimitGuard(limiter: RateLimiter, options?: RateLimitGuardOptions): RateLimitGuard;
export declare function enforceRateLimit(limiter: RateLimiter, request: FastifyRequest, reply: FastifyReply, key: string, errorResponse?: (request: FastifyRequest) => unknown): Promise<boolean>;
export {};
//# sourceMappingURL=rate-limit.d.ts.map