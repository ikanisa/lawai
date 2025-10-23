import OpenAI, { APIError } from 'openai';
const env = typeof process !== 'undefined' ? process.env : undefined;
const clientCache = new Map();
function normalizeHeaders(source) {
    if (!source) {
        return {};
    }
    if (typeof Headers !== 'undefined' && source instanceof Headers) {
        const entries = {};
        source.forEach((value, key) => {
            entries[key] = value;
        });
        return entries;
    }
    if (Array.isArray(source)) {
        return source.reduce((acc, [key, value]) => {
            acc[key] = Array.isArray(value) ? value.join(',') : value;
            return acc;
        }, {});
    }
    return Object.entries(source).reduce((acc, [key, value]) => {
        if (Array.isArray(value)) {
            acc[key] = value.join(',');
        }
        else if (typeof value === 'string') {
            acc[key] = value;
        }
        return acc;
    }, {});
}
function buildCacheKey(config) {
    const { apiKey, baseURL, organization, project, timeout, maxRetries, defaultHeaders, cacheKeySuffix, } = config;
    const normalizedHeaders = normalizeHeaders(defaultHeaders);
    const headerEntries = Object.entries(normalizedHeaders).sort();
    const headerFingerprint = headerEntries.map(([key, value]) => `${key}:${value}`).join('|');
    return [
        apiKey,
        baseURL ?? '',
        organization ?? '',
        project ?? '',
        timeout ?? '',
        maxRetries ?? '',
        headerFingerprint,
        cacheKeySuffix ?? '',
    ].join('::');
}
export function getOpenAIClient(config) {
    if (!config.apiKey) {
        throw new Error('OPENAI_API_KEY is required to initialise the OpenAI client');
    }
    const cacheKey = buildCacheKey(config);
    const cached = clientCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const { apiKey, defaultHeaders, maxRetries = 2, timeout = 45_000, requestTags, organization, project, ...rest } = config;
    const normalizedHeaders = normalizeHeaders(defaultHeaders);
    const computedHeaders = {
        'OpenAI-Beta': 'assistants=v2',
        ...normalizedHeaders,
    };
    const headerTags = requestTags ?? normalizedHeaders['OpenAI-Request-Tags'] ?? env?.OPENAI_REQUEST_TAGS ?? undefined;
    if (headerTags && !computedHeaders['OpenAI-Request-Tags']) {
        computedHeaders['OpenAI-Request-Tags'] = headerTags;
    }
    const organizationHeader = organization ?? env?.OPENAI_ORGANIZATION;
    const projectHeader = project ?? env?.OPENAI_PROJECT;
    if (organizationHeader) {
        computedHeaders['OpenAI-Organization'] = organizationHeader;
    }
    if (projectHeader) {
        computedHeaders['OpenAI-Project'] = projectHeader;
    }
    const client = new OpenAI({
        apiKey,
        maxRetries,
        timeout,
        defaultHeaders: computedHeaders,
        organization: organizationHeader,
        project: projectHeader,
        ...rest,
    });
    clientCache.set(cacheKey, client);
    return client;
}
export function resetOpenAIClientCache() {
    clientCache.clear();
}
const debugRequestsEnabled = typeof process !== 'undefined' && process?.env?.OPENAI_DEBUG_REQUESTS === '1';
export function isOpenAIDebugEnabled() {
    return debugRequestsEnabled;
}
export async function fetchOpenAIDebugDetails(client, error) {
    if (!debugRequestsEnabled) {
        return null;
    }
    if (!(error instanceof APIError)) {
        return null;
    }
    const requestId = error.request_id ?? null;
    if (!requestId) {
        return null;
    }
    try {
        const debuggingApi = client.debugging?.requests;
        if (!debuggingApi) {
            return { requestId, debugError: 'debugging_api_unavailable' };
        }
        const details = await debuggingApi.retrieve(requestId);
        return { requestId, details };
    }
    catch (debugError) {
        return { requestId, debugError };
    }
}
