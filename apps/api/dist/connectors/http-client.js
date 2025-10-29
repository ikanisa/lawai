export class ConnectorHttpClient {
    endpoint;
    headers;
    timeoutMs;
    logger;
    constructor(options) {
        const { config, logger } = options;
        if (!config?.endpoint) {
            throw new Error('connector_endpoint_missing');
        }
        this.endpoint = config.endpoint.replace(/\/$/, '');
        this.timeoutMs = config.timeoutMs ?? 15000;
        this.logger = logger;
        const headers = {
            'Content-Type': 'application/json',
        };
        if (config.apiKey) {
            headers.Authorization = `Bearer ${config.apiKey}`;
        }
        if (config.tenantId) {
            headers['X-Tenant-Id'] = config.tenantId;
        }
        if (config.extraHeaders) {
            for (const [key, value] of Object.entries(config.extraHeaders)) {
                headers[key] = value;
            }
        }
        this.headers = headers;
    }
    buildUrl(path) {
        if (!path) {
            return this.endpoint;
        }
        if (path.startsWith('http')) {
            return path;
        }
        if (path.startsWith('/')) {
            return `${this.endpoint}${path}`;
        }
        return `${this.endpoint}/${path}`;
    }
    async get(path, options = {}) {
        const url = new URL(this.buildUrl(path));
        if (options.query) {
            options.query.forEach((value, key) => url.searchParams.set(key, value));
        }
        return this.request(url.toString(), { method: 'GET' });
    }
    async post(path, body) {
        return this.request(this.buildUrl(path), {
            method: 'POST',
            body: JSON.stringify(body ?? {}),
        });
    }
    async put(path, body) {
        return this.request(this.buildUrl(path), {
            method: 'PUT',
            body: JSON.stringify(body ?? {}),
        });
    }
    async request(url, init) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await fetch(url, {
                ...init,
                headers: {
                    ...this.headers,
                    ...(init.headers ?? {}),
                },
                signal: controller.signal,
            });
            if (!response.ok) {
                const payload = await response.text().catch(() => '');
                this.logger?.warn?.({ url, status: response.status, payload }, 'connector_http_non_200');
                throw new Error(`connector_http_error:${response.status}`);
            }
            const contentType = response.headers.get('content-type') ?? '';
            if (contentType.includes('application/json')) {
                return (await response.json());
            }
            return (await response.text());
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown_connector_error';
            this.logger?.error?.({ url, error: message }, 'connector_http_request_failed');
            throw error instanceof Error ? error : new Error(message);
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
