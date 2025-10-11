import OpenAI, { APIError, type ClientOptions } from 'openai';

const env = typeof process !== 'undefined' ? process.env : undefined;

export type OpenAIClientConfig = ClientOptions & {
  apiKey: string;
  /** Optional semantic identifier used for cache segregation */
  cacheKeySuffix?: string;
  /** Optional request tagging override */
  requestTags?: string;
};

const clientCache = new Map<string, OpenAI>();

function buildCacheKey(config: OpenAIClientConfig): string {
  const {
    apiKey,
    baseURL,
    organization,
    project,
    timeout,
    maxRetries,
    defaultHeaders,
    cacheKeySuffix,
  } = config;

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

export function getOpenAIClient(config: OpenAIClientConfig): OpenAI {
  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY is required to initialise the OpenAI client');
  }

  const cacheKey = buildCacheKey(config);
  const cached = clientCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const {
    apiKey,
    defaultHeaders,
    maxRetries = 2,
    timeout = 45_000,
    requestTags,
    organization,
    project,
    ...rest
  } = config;

  const computedHeaders: Record<string, string> = {
    'OpenAI-Beta': 'assistants=v2',
    ...defaultHeaders,
  };

  const headerTags =
    requestTags ?? defaultHeaders?.['OpenAI-Request-Tags'] ?? env?.OPENAI_REQUEST_TAGS ?? undefined;
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

export function resetOpenAIClientCache(): void {
  clientCache.clear();
}

const debugRequestsEnabled =
  typeof process !== 'undefined' && process?.env?.OPENAI_DEBUG_REQUESTS === '1';

export function isOpenAIDebugEnabled(): boolean {
  return debugRequestsEnabled;
}

export type OpenAIDebugDetails =
  | { requestId: string; details: unknown }
  | { requestId: string; debugError: unknown };

export async function fetchOpenAIDebugDetails(
  client: OpenAI,
  error: unknown,
): Promise<OpenAIDebugDetails | null> {
  if (!debugRequestsEnabled) {
    return null;
  }

  if (!(error instanceof APIError)) {
    return null;
  }

  const requestId = (error as APIError & { request_id?: string }).request_id ?? null;

  if (!requestId) {
    return null;
  }

  try {
    const debuggingApi = (client as any).debugging?.requests;
    if (!debuggingApi) {
      return { requestId, debugError: 'debugging_api_unavailable' };
    }
    const details = await debuggingApi.retrieve(requestId);
    return { requestId, details };
  } catch (debugError) {
    return { requestId, debugError };
  }
}
