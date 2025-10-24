// deno-lint-ignore-file no-explicit-any
import {
  context,
  trace,
  SpanStatusCode,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  type Span,
  type Counter,
  type Histogram,
} from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader, MeterProvider } from '@opentelemetry/sdk-metrics';
import { BasicTracerProvider, BatchSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import type { EdgeTelemetryConfig, TelemetryRuntime } from './types.js';

let tracerProvider: BasicTracerProvider | null = null;
let spanProcessor: SpanProcessor | null = null;
let meterProvider: MeterProvider | null = null;
let requestCounter: Counter | null = null;
let durationHistogram: Histogram | null = null;
let serviceName: string | null = null;
let telemetryRuntime: TelemetryRuntime | null = null;
let servePatched = false;

type EdgeServeHandlerInfo = {
  remoteAddr?: { hostname?: string; port?: number };
  [key: string]: unknown;
};

const deno = (globalThis as typeof globalThis & { Deno?: { env?: { get?: (key: string) => string | undefined }; serve?: (...args: any[]) => any } }).Deno;

const getDenoEnv = (key: string) => deno?.env?.get?.(key);

function resolveEndpoint(config: EdgeTelemetryConfig, kind: 'trace' | 'metric'): string | undefined {
  const base = kind === 'trace' ? config.otlpEndpoint : config.metricsEndpoint ?? config.otlpEndpoint;
  const envSpecific = kind === 'trace' ? getDenoEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT') : getDenoEnv('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT');
  const sharedEnv = getDenoEnv('OTEL_EXPORTER_OTLP_ENDPOINT');
  const candidate = base ?? envSpecific ?? sharedEnv;
  if (!candidate) return undefined;
  if (candidate.endsWith('/v1/' + (kind === 'trace' ? 'traces' : 'metrics'))) {
    return candidate;
  }
  return `${candidate.replace(/\/$/, '')}/v1/${kind === 'trace' ? 'traces' : 'metrics'}`;
}

function buildResource(config: EdgeTelemetryConfig): Resource {
  return new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion ?? 'edge-unknown',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment ?? getDenoEnv('DENO_DEPLOYMENT_ID') ?? 'development',
    ...config.attributes,
  });
}

function ensurePatchedServe(tracerName: string) {
  if (servePatched) return;
  const originalServe = deno?.serve?.bind(deno);
  if (!deno || typeof originalServe !== 'function') {
    throw new Error('Deno.serve is not available for telemetry wrapping');
  }
  const tracer = trace.getTracer(tracerName);
  const wrapHandler = (handler: (request: Request, info: EdgeServeHandlerInfo) => Response | Promise<Response>) => {
    return async (request: Request, info: EdgeServeHandlerInfo): Promise<Response> => {
      const span = tracer.startSpan('edge.request', {
        attributes: {
          'http.method': request.method,
          'http.target': new URL(request.url).pathname,
          'http.scheme': new URL(request.url).protocol.replace(':', ''),
          'faas.trigger': 'http',
          'service.instance.id': getDenoEnv('DENO_DEPLOYMENT_ID') ?? getDenoEnv('HOSTNAME') ?? 'edge',
        },
      });
      const start = performance.now();
      const ctx = trace.setSpan(context.active(), span);
      try {
        const response = await context.with(ctx, () => handler(request, info));
        const status = response.status ?? 200;
        span.setAttribute('http.status_code', status);
        if (status >= 500) {
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
        requestCounter?.add(1, {
          'http.method': request.method,
          'http.status_code': status,
        });
        durationHistogram?.record(Math.max(performance.now() - start, 0), {
          'http.method': request.method,
          'http.status_code': status,
        });
        return response;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        requestCounter?.add(1, {
          'http.method': request.method,
          'http.status_code': 500,
          error: error instanceof Error ? error.name : 'unknown',
        });
        durationHistogram?.record(Math.max(performance.now() - start, 0), {
          'http.method': request.method,
          'http.status_code': 500,
        });
        throw error;
      } finally {
        span.end();
      }
    };
  };

  deno.serve = function (...args: any[]) {
    if (args.length === 1 && typeof args[0] === 'function') {
      return originalServe(wrapHandler(args[0]));
    }
    if (args.length === 2 && typeof args[1] === 'function') {
      return originalServe(args[0], wrapHandler(args[1]));
    }
    return originalServe(...args);
  };
  servePatched = true;
}

export async function initEdgeTelemetry(config: EdgeTelemetryConfig): Promise<TelemetryRuntime> {
  if (telemetryRuntime) {
    return telemetryRuntime;
  }

  if (config.logLevel !== undefined) {
    diag.setLogger(new DiagConsoleLogger(), config.logLevel as DiagLogLevel);
  }

  const resource = buildResource(config);

  tracerProvider = new BasicTracerProvider({ resource });
  const traceEndpoint = resolveEndpoint(config, 'trace');
  const traceExporter = traceEndpoint
    ? new OTLPTraceExporter({ url: traceEndpoint, headers: config.headers })
    : new OTLPTraceExporter({ headers: config.headers });
  spanProcessor = new BatchSpanProcessor(traceExporter, { scheduledDelayMillis: 5_000, exportTimeoutMillis: 10_000 });
  tracerProvider.addSpanProcessor(spanProcessor);
  tracerProvider.register();

  meterProvider = new MeterProvider({ resource });
  const metricEndpoint = resolveEndpoint(config, 'metric');
  const metricsExporter = metricEndpoint
    ? new OTLPMetricExporter({ url: metricEndpoint, headers: config.headers })
    : new OTLPMetricExporter({ headers: config.headers });
  const metricReader = new PeriodicExportingMetricReader({ exporter: metricsExporter, exportIntervalMillis: 20_000 });
  meterProvider.addMetricReader(metricReader);

  const meter = meterProvider.getMeter(config.serviceName);
  requestCounter = meter.createCounter(config.requestCounterName ?? 'edge_http_requests_total', {
    description: 'Total number of processed edge requests',
  });
  durationHistogram = meter.createHistogram(config.durationHistogramName ?? 'edge_http_request_duration_ms', {
    description: 'Duration of edge requests in milliseconds',
    unit: 'ms',
  });

  serviceName = config.serviceName;
  ensurePatchedServe(serviceName);

  telemetryRuntime = {
    async shutdown() {
      await meterProvider?.shutdown();
      await spanProcessor?.shutdown?.();
      await tracerProvider?.shutdown();
      meterProvider = null;
      tracerProvider = null;
      spanProcessor = null;
      requestCounter = null;
      durationHistogram = null;
      telemetryRuntime = null;
      serviceName = null;
    },
  };
  return telemetryRuntime;
}

export async function withEdgeSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean> | undefined,
  handler: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer(serviceName ?? 'edge');
  const span = tracer.startSpan(name, { attributes });
  const ctx = trace.setSpan(context.active(), span);
  try {
    return await context.with(ctx, () => handler(span));
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    span.end();
  }
}

export function getEdgeMeter() {
  if (!meterProvider) {
    throw new Error('Edge telemetry has not been initialised');
  }
  return meterProvider.getMeter(serviceName ?? 'edge');
}
