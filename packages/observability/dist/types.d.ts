import type { Instrumentation } from '@opentelemetry/instrumentation';
export interface BaseTelemetryConfig {
    serviceName: string;
    serviceVersion?: string;
    environment?: string;
    otlpEndpoint?: string;
    metricsEndpoint?: string;
    headers?: Record<string, string>;
    attributes?: Record<string, string | number | boolean>;
    logLevel?: number;
}
export interface NodeTelemetryConfig extends BaseTelemetryConfig {
    instrumentations?: Instrumentation[];
}
export interface EdgeTelemetryConfig extends BaseTelemetryConfig {
    requestCounterName?: string;
    durationHistogramName?: string;
}
export interface TelemetryRuntime {
    shutdown(): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map