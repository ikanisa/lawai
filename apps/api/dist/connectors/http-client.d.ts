import type { OrchestratorLogger } from '../orchestrator.js';
export interface ConnectorConfig {
    endpoint: string;
    apiKey?: string;
    tenantId?: string;
    extraHeaders?: Record<string, string>;
    timeoutMs?: number;
}
export interface HttpClientOptions {
    config: ConnectorConfig;
    logger?: OrchestratorLogger;
}
export declare class ConnectorHttpClient {
    private readonly endpoint;
    private readonly headers;
    private readonly timeoutMs;
    private readonly logger?;
    constructor(options: HttpClientOptions);
    private buildUrl;
    get<T>(path: string, options?: {
        query?: URLSearchParams;
    }): Promise<T>;
    post<T>(path: string, body: unknown): Promise<T>;
    put<T>(path: string, body: unknown): Promise<T>;
    private request;
}
//# sourceMappingURL=http-client.d.ts.map