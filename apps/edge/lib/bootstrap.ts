import { initEdgeTelemetry, type EdgeTelemetryRuntime, type EdgeTelemetryConfig } from './telemetry.ts';

const runtimeCache = new Map<string, Promise<EdgeTelemetryRuntime>>();

export function bootstrapEdgeTelemetry(serviceName: string, config: Omit<EdgeTelemetryConfig, 'serviceName'> = {}) {
  if (!runtimeCache.has(serviceName)) {
    runtimeCache.set(
      serviceName,
      initEdgeTelemetry({
        serviceName,
        attributes: { 'service.namespace': 'avocat-ai-edge', ...config.attributes },
        headers: config.headers,
        metricsEndpoint: config.metricsEndpoint,
        otlpEndpoint: config.otlpEndpoint,
        serviceVersion: config.serviceVersion,
        logLevel: config.logLevel,
      }),
    );
  }
  return runtimeCache.get(serviceName)!;
}
