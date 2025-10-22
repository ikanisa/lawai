import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';

interface TelemetryOptions {
  serviceName: string;
  otlpEndpoint?: string;
  metricsEndpoint?: string;
  headers?: Record<string, string>;
  environment?: string;
  enabled?: boolean;
  logLevel?: DiagLogLevel;
}

let sdk: NodeSDK | null = null;
let initPromise: Promise<void> | null = null;

function normaliseUrl(base: string | undefined, suffix: string): string | undefined {
  if (!base) {
    return undefined;
  }
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}${suffix}`;
}

export async function initTelemetry(options: TelemetryOptions): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  if (options.enabled === false) {
    initPromise = Promise.resolve();
    return initPromise;
  }

  const headers = options.headers ?? {};
  if (sdk) {
    initPromise = sdk.start();
    return initPromise;
  }

  const traceExporter = new OTLPTraceExporter({
    url: normaliseUrl(options.otlpEndpoint, '/v1/traces'),
    headers,
  });

  const metricExporter = new OTLPMetricExporter({
    url: normaliseUrl(options.metricsEndpoint ?? options.otlpEndpoint, '/v1/metrics'),
    headers,
  });

  if (options.logLevel) {
    diag.setLogger(new DiagConsoleLogger(), options.logLevel);
  }

  sdk = new NodeSDK({
    resource: new Resource({
      'service.name': options.serviceName,
      'deployment.environment': options.environment ?? process.env.NODE_ENV ?? 'development',
    }),
    traceExporter,
    metricExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  initPromise = sdk.start();
  return initPromise;
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }
  await sdk.shutdown().catch((error) => {
    diag.error('Telemetry shutdown failed', error);
  });
  sdk = null;
  initPromise = null;
}
