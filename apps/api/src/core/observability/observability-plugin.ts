import { randomUUID } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { incrementCounter } from '../../observability/metrics.js';

declare module 'fastify' {
  interface FastifyRequest {
    observability?: {
      traceId: string;
      startedAt: bigint;
    };
  }
}

function assignTraceLogger(request: FastifyRequest, traceId: string) {
  const child = request.log.child({ traceId });
  (request as any).log = child;
}

async function handleRequestLifecycle(request: FastifyRequest, reply: FastifyReply) {
  const traceId = typeof request.headers['x-trace-id'] === 'string' ? request.headers['x-trace-id']! : randomUUID();
  request.observability = {
    traceId,
    startedAt: process.hrtime.bigint(),
  };
  request.headers['x-trace-id'] = traceId;
  reply.header('x-trace-id', traceId);
  assignTraceLogger(request, traceId);
  request.log.debug({ method: request.method, url: request.url }, 'request_started');
}

async function handleResponseLifecycle(request: FastifyRequest, reply: FastifyReply) {
  if (!request.observability) {
    return;
  }
  const durationMs = Number(process.hrtime.bigint() - request.observability.startedAt) / 1_000_000;
  request.log.info(
    { method: request.method, url: request.url, statusCode: reply.statusCode, durationMs },
    'request_completed',
  );
  const route = request.routeOptions?.url ?? (request as any).routerPath ?? request.url;
  incrementCounter('http_requests_total', {
    method: request.method,
    status: reply.statusCode,
    route,
  });
}

async function handleErrorLifecycle(request: FastifyRequest, reply: FastifyReply, error: Error) {
  if (!request.observability) {
    return;
  }
  const durationMs = Number(process.hrtime.bigint() - request.observability.startedAt) / 1_000_000;
  request.log.error(
    { method: request.method, url: request.url, statusCode: reply.statusCode, durationMs, err: error },
    'request_failed',
  );
}

export const observabilityPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', handleRequestLifecycle);
  app.addHook('onResponse', handleResponseLifecycle);
  app.addHook('onError', handleErrorLifecycle);
});
