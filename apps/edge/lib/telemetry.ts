import {
  context,
  trace,
  SpanStatusCode,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  type Span,
} from 'npm:@opentelemetry/api@1.10.0';
import { OTLPTraceExporter } from 'npm:@opentelemetry/exporter-trace-otlp-http@0.52.0';
import { OTLPMetricExporter } from 'npm:@opentelemetry/exporter-metrics-otlp-http@0.52.0';
import { Resource } from 'npm:@opentelemetry/resources@1.17.1';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  type Counter,
  type Histogram,
} from 'npm:@opentelemetry/sdk-metrics@1.17.1';
import { BasicTracerProvider, BatchSpanProcessor } from 'npm:@opentelemetry/sdk-trace-base@1.17.1';
import { SemanticResourceAttributes } from 'npm:@opentelemetry/semantic-conventions@1.17.1';

export interface EdgeTelemetryRuntime {
  shutdown(): Promise<void>;
}

let tracerProvider: BasicTracerProvider | null = null;
let meterProvider: MeterProvider | null = null;
let spanProcessor: BatchSpanProcessor | null = null;
let telemetryRuntime: EdgeTelemetryRuntime | null = null;
let requestCounter: Counter | null = null;
let durationHistogram: Histogram | null = null;
let servePatched = false;
let serviceName = 'edge';

function resolveEndpoint(kind: 'trace' | 'metric', override?: string): string | undefined {
  const envKey = kind === 'trace' ? 'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT' : 'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT';
  const candidate = override ?? Deno.env.get(envKey) ?? Deno.env.get('OTEL_EXPORTER_OTLP_ENDPOINT');
  if (!candidate) return undefined;
  if (candidate.endsWith(`/v1/${kind === 'trace' ? 'traces' : 'metrics'}`)) {
    return candidate;
  }
  return `${candidate.replace(/\/$/, '')}/v1/${kind === 'trace' ? 'traces' : 'metrics'}`;
}

function normaliseHeaders(raw: Record<string, string> | undefined) {
  if (!raw) return undefined;
  const entries = Object.entries(raw).filter(([key, value]) => key && value);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function buildResource(name: string, version?: string, attributes?: Record<string, string | number | boolean>) {
  return new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: name,
    [SemanticResourceAttributes.SERVICE_VERSION]: version ?? 'edge',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
      Deno.env.get('DENO_DEPLOYMENT_ID') ?? Deno.env.get('NODE_ENV') ?? 'development',
    ...attributes,
  });
}

function ensurePatchedServe() {
  if (servePatched) return;
  const originalServe = (Deno as { serve?: typeof Deno.serve }).serve?.bind(Deno);
  if (!originalServe) {
    throw new Error('Deno.serve unavailable; cannot enable telemetry');
  }
  const tracer = trace.getTracer(serviceName);
  const wrapHandler = (handler: Deno.ServeHandler): Deno.ServeHandler => {
    return async (request, info) => {
      const span = tracer.startSpan('edge.request', {
        attributes: {
          'http.method': request.method,
          'http.target': new URL(request.url).pathname,
          'service.instance.id': Deno.env.get('DENO_DEPLOYMENT_ID') ?? Deno.env.get('HOSTNAME') ?? 'edge',
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
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        requestCounter?.add(1, { 'http.method': request.method, 'http.status_code': status });
        durationHistogram?.record(Math.max(performance.now() - start, 0), {
          'http.method': request.method,
          'http.status_code': status,
        });
        return response;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
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

  (Deno as any).serve = function (...args: unknown[]) {
    if (args.length === 1 && typeof args[0] === 'function') {
      return originalServe(wrapHandler(args[0] as Deno.ServeHandler));
    }
    if (args.length === 2 && typeof args[1] === 'function') {
      return originalServe(args[0] as Deno.ServeOptions, wrapHandler(args[1] as Deno.ServeHandler));
    }
    return originalServe(...args);
  };
  servePatched = true;
}

export interface EdgeTelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  attributes?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  otlpEndpoint?: string;
  metricsEndpoint?: string;
  logLevel?: DiagLogLevel;
}

export async function initEdgeTelemetry(config: EdgeTelemetryConfig): Promise<EdgeTelemetryRuntime> {
  if (telemetryRuntime) {
    return telemetryRuntime;
  }

  if (config.logLevel !== undefined) {
    diag.setLogger(new DiagConsoleLogger(), config.logLevel);
  }

  serviceName = config.serviceName;
  const resource = buildResource(config.serviceName, config.serviceVersion, config.attributes);

  tracerProvider = new BasicTracerProvider({ resource });
  const traceEndpoint = resolveEndpoint('trace', config.otlpEndpoint);
  const traceExporter = traceEndpoint
    ? new OTLPTraceExporter({ url: traceEndpoint, headers: normaliseHeaders(config.headers) })
    : new OTLPTraceExporter({ headers: normaliseHeaders(config.headers) });
  spanProcessor = new BatchSpanProcessor(traceExporter, { scheduledDelayMillis: 5_000, exportTimeoutMillis: 10_000 });
  tracerProvider.addSpanProcessor(spanProcessor);
  tracerProvider.register();

  meterProvider = new MeterProvider({ resource });
  const metricEndpoint = resolveEndpoint('metric', config.metricsEndpoint);
  const metricExporter = metricEndpoint
    ? new OTLPMetricExporter({ url: metricEndpoint, headers: normaliseHeaders(config.headers) })
    : new OTLPMetricExporter({ headers: normaliseHeaders(config.headers) });
  const metricReader = new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 20_000 });
  meterProvider.addMetricReader(metricReader);

  const meter = meterProvider.getMeter(config.serviceName);
  requestCounter = meter.createCounter('edge_http_requests_total', {
    description: 'Total number of processed edge requests',
  });
  durationHistogram = meter.createHistogram('edge_http_request_duration_ms', {
    description: 'Duration of edge requests in milliseconds',
    unit: 'ms',
  });

  ensurePatchedServe();

  telemetryRuntime = {
    async shutdown() {
      await meterProvider?.shutdown();
      await spanProcessor?.shutdown();
      await tracerProvider?.shutdown();
      tracerProvider = null;
      meterProvider = null;
      spanProcessor = null;
      telemetryRuntime = null;
      requestCounter = null;
      durationHistogram = null;
      servePatched = false;
    },
  };

  return telemetryRuntime;
}

export async function withEdgeSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean> | undefined,
  handler: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer(serviceName);
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
  return meterProvider.getMeter(serviceName);
}
