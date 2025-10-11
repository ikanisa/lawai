import OpenAI, { APIError } from 'openai';
const env = typeof process !== 'undefined' ? process.env : undefined;
const clientCache = new Map();
function buildCacheKey(config) {
    const { apiKey, baseURL, organization, project, timeout, maxRetries, defaultHeaders, cacheKeySuffix, } = config;
    const headerEntries = defaultHeaders ? Object.entries(defaultHeaders).sort() : [];
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
    const computedHeaders = {
        'OpenAI-Beta': 'assistants=v2',
        ...defaultHeaders,
    };
    const headerTags = requestTags ?? defaultHeaders?.['OpenAI-Request-Tags'] ?? env?.OPENAI_REQUEST_TAGS ?? undefined;
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
