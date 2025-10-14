import type { FastifyBaseLogger, FastifyRequest } from 'fastify';

interface SpanOptions {
  name: string;
  attributes?: Record<string, unknown>;
}

interface SpanContext {
  logger: FastifyBaseLogger;
  setAttribute: (key: string, value: unknown) => void;
}

export async function withRequestSpan<T>(
  request: FastifyRequest,
  options: SpanOptions,
  handler: (context: SpanContext) => Promise<T>,
): Promise<T> {
  const start = process.hrtime.bigint();
  const spanAttributes = { ...(options.attributes ?? {}) };
  const spanLogger = request.log.child({ span: options.name, ...spanAttributes });

  const setAttribute = (key: string, value: unknown) => {
    spanAttributes[key] = value;
  };

  spanLogger.debug({ event: 'span.start', ...spanAttributes }, 'span started');

  try {
    const result = await handler({ logger: spanLogger, setAttribute });
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    spanLogger.info({ event: 'span.success', durationMs, ...spanAttributes }, 'span completed');
    return result;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    spanLogger.error({ event: 'span.error', durationMs, err: error, ...spanAttributes }, 'span failed');
    throw error;
  }
}
