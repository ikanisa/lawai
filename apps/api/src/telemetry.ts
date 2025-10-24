import { initNodeTelemetry, type TelemetryRuntime } from '@avocat-ai/observability';
import { markMeterProviderReady } from './observability/metrics.js';

let runtimePromise: Promise<TelemetryRuntime> | null = null;

function parseHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const headers: Record<string, string> = {};
  for (const part of raw.split(',')) {
    const [key, ...valueParts] = part.split('=');
    if (!key || valueParts.length === 0) continue;
    headers[key.trim()] = valueParts.join('=').trim();
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function getServiceVersion(): string {
  const candidates = [
    process.env.API_VERSION,
    process.env.GIT_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.npm_package_version,
  ];
  return candidates.find((value) => typeof value === 'string' && value.length > 0) ?? 'dev';
}

export async function ensureTelemetryRuntime(): Promise<TelemetryRuntime> {
  if (!runtimePromise) {
    runtimePromise = initNodeTelemetry({
      serviceName: 'avocat-api',
      serviceVersion: getServiceVersion(),
      environment: process.env.NODE_ENV ?? 'development',
      headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
      attributes: {
        'service.namespace': 'avocat-ai',
      },
    }).then((runtime) => {
      markMeterProviderReady();
      return runtime;
    });
  }
  return runtimePromise;
}
