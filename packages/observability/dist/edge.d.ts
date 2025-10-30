import { type Span } from '@opentelemetry/api';
import type { EdgeTelemetryConfig, TelemetryRuntime } from './types.js';
export declare function initEdgeTelemetry(config: EdgeTelemetryConfig): Promise<TelemetryRuntime>;
export declare function withEdgeSpan<T>(name: string, attributes: Record<string, string | number | boolean> | undefined, handler: (span: Span) => Promise<T>): Promise<T>;
export declare function getEdgeMeter(): import("@opentelemetry/api").Meter;
//# sourceMappingURL=edge.d.ts.map