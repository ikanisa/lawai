import type { FastifyBaseLogger, FastifyRequest } from 'fastify';
interface SpanOptions {
    name: string;
    attributes?: Record<string, unknown>;
}
interface SpanContext {
    logger: FastifyBaseLogger;
    setAttribute: (key: string, value: unknown) => void;
}
export declare function withRequestSpan<T>(request: FastifyRequest, options: SpanOptions, handler: (context: SpanContext) => Promise<T>): Promise<T>;
export {};
//# sourceMappingURL=spans.d.ts.map