import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { type Instrumentation } from '@opentelemetry/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { context as apiContext } from '@opentelemetry/api';
import { type NodeTelemetryConfig, type TelemetryRuntime } from './types.js';

let sdk: NodeSDK | null = null;
let contextManager: AsyncHooksContextManager | null = null;

function resolveEndpoint(config: NodeTelemetryConfig, kind: 'trace' | 'metric'): string | undefined {
  const explicit = kind === 'trace' ? config.otlpEndpoint : config.metricsEndpoint ?? config.otlpEndpoint;
  if (explicit) {
    return explicit.endsWith('/v1/' + (kind === 'trace' ? 'traces' : 'metrics'))
      ? explicit
      : `${explicit.replace(/\/$/, '')}/v1/${kind === 'trace' ? 'traces' : 'metrics'}`;
  }
  const envKey = kind === 'trace' ? 'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT' : 'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT';
  const fallback = process.env[envKey] ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!fallback) return undefined;
  if (fallback.endsWith('/v1/' + (kind === 'trace' ? 'traces' : 'metrics'))) {
    return fallback;
  }
  return `${fallback.replace(/\/$/, '')}/v1/${kind === 'trace' ? 'traces' : 'metrics'}`;
}

function buildResource(config: NodeTelemetryConfig): Resource {
  return new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion ?? 'unknown',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment ?? process.env.NODE_ENV ?? 'development',
    ...config.attributes,
  });
}

export async function initNodeTelemetry(config: NodeTelemetryConfig): Promise<TelemetryRuntime> {
  if (sdk) {
    return {
      async shutdown() {
        await sdk?.shutdown();
        sdk = null;
        contextManager?.disable();
        contextManager = null;
      },
    };
  }

  if (config.logLevel !== undefined) {
    diag.setLogger(new DiagConsoleLogger(), config.logLevel as DiagLogLevel);
  } else if (process.env.OTEL_DIAGNOSTIC_LOG_LEVEL) {
    const level = process.env.OTEL_DIAGNOSTIC_LOG_LEVEL.toUpperCase();
    const diagLevels = DiagLogLevel as unknown as Record<string, DiagLogLevel>;
    diag.setLogger(new DiagConsoleLogger(), diagLevels[level] ?? DiagLogLevel.ERROR);
  }

  const traceExporter = (() => {
    const endpoint = resolveEndpoint(config, 'trace');
    return endpoint
      ? new OTLPTraceExporter({ url: endpoint, headers: config.headers })
      : new OTLPTraceExporter({ headers: config.headers });
  })();

  const metricExporter = (() => {
    const endpoint = resolveEndpoint(config, 'metric');
    return endpoint
      ? new OTLPMetricExporter({ url: endpoint, headers: config.headers })
      : new OTLPMetricExporter({ headers: config.headers });
  })();

  const resource = buildResource(config);

  const instrumentations: Instrumentation[] = config.instrumentations ?? [];

  const periodicMetricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 15_000,
    exportTimeoutMillis: 10_000,
  });

  sdk = new NodeSDK({
    traceExporter,
    metricReader: periodicMetricReader as unknown as any,
    resource,
    instrumentations,
  });

  contextManager = new AsyncHooksContextManager().enable();
  apiContext.setGlobalContextManager(contextManager);

  await sdk.start();

  return {
    async shutdown() {
      await sdk?.shutdown();
      sdk = null;
      contextManager?.disable();
      contextManager = null;
    },
  };
}
