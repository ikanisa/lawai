type LogLevel = 'info' | 'warn';
type TelemetryRecorder = {
    log?: (level: LogLevel, message: string, context?: Record<string, unknown>) => void;
    metric?: (name: string, labels: Record<string, unknown>) => void;
};
export declare function resolveDomainAllowlistOverride(rawValue: unknown, options?: {
    telemetry?: TelemetryRecorder;
    maxEntries?: number;
}): string[] | null;
export declare const MAX_DOMAIN_OVERRIDE_ENTRIES = 20;
export {};
//# sourceMappingURL=allowlist-override.d.ts.map