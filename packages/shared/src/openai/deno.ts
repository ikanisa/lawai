import { z } from 'zod';
export interface OpenAIDenoClientConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  project?: string;
  requestTags?: string;
}

interface OpenAIDenoHeadersOptions {
  contentType?: string;
}

function buildHeaders(config: OpenAIDenoClientConfig, options: OpenAIDenoHeadersOptions = {}) {
  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY is required for Deno client');
  }

  const denoEnvGet = (key: string) => (globalThis as { Deno?: { env?: { get?: (name: string) => string | undefined } } }).Deno?.env?.get?.(key);

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${config.apiKey}`);
  headers.set('OpenAI-Beta', 'assistants=v2');

  const requestTags =
    config.requestTags ?? denoEnvGet('OPENAI_REQUEST_TAGS') ?? 'service=edge,component=crawl-authorities';
  if (requestTags) {
    headers.set('OpenAI-Request-Tags', requestTags);
  }

  const organization = config.organization ?? denoEnvGet('OPENAI_ORGANIZATION');
  const project = config.project ?? denoEnvGet('OPENAI_PROJECT');
  if (organization) {
    headers.set('OpenAI-Organization', organization);
  }
  if (project) {
    headers.set('OpenAI-Project', project);
  }

  if (options.contentType) {
    headers.set('Content-Type', options.contentType);
  }

  return headers;
}

function buildBaseUrl(config: OpenAIDenoClientConfig): string {
  return config.baseUrl ?? 'https://api.openai.com/v1';
}

export interface OpenAIDenoClient {
  files: {
    create(params: {
      purpose: 'assistants';
      data: Uint8Array | ArrayBuffer | Blob;
      filename: string;
      mimeType?: string;
    }): Promise<{ id: string }>;
  };
  beta: {
    vectorStores: {
      files: {
        create(vectorStoreId: string, body: { file_id: string }): Promise<void>;
      };
    };
  };
  debugging: {
    requests: {
      retrieve(requestId: string): Promise<unknown>;
    };
  };
}

type OpenAIErrorPayload = {
  error?: {
    message?: unknown;
  };
};

const FileCreateResponseSchema = z.object({ id: z.string() });
const VectorStoreResponseSchema = z.unknown();
const DebuggingRequestResponseSchema = z.unknown();

async function parseJsonResponse<T>(
  response: Response,
  context: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const fallbackMessage = `${context}_failed`;
  const payload: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = getErrorMessage(payload, fallbackMessage);
    throw new Error(message);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`${context}_invalid_response`);
  }

  return parsed.data;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null) {
    const error = (payload as OpenAIErrorPayload).error;
    if (error && typeof error.message === 'string') {
      return error.message;
    }
  }
  return fallback;
}

export function createOpenAIDenoClient(config: OpenAIDenoClientConfig): OpenAIDenoClient {
  const baseUrl = buildBaseUrl(config);

  return {
    files: {
      async create(params) {
        const form = new FormData();
        form.append('purpose', params.purpose);
        const blob =
          params.data instanceof Blob
            ? params.data
            : new Blob([params.data as BlobPart], { type: params.mimeType ?? 'application/octet-stream' });
        form.append('file', new File([blob], params.filename, { type: params.mimeType ?? blob.type }));

        const response = await fetch(`${baseUrl}/files`, {
          method: 'POST',
          headers: buildHeaders(config),
          body: form,
        });

        return parseJsonResponse(response, 'file_upload', FileCreateResponseSchema);
      },
    },
    beta: {
      vectorStores: {
        files: {
          async create(vectorStoreId, body) {
            const response = await fetch(`${baseUrl}/vector_stores/${vectorStoreId}/files`, {
              method: 'POST',
              headers: buildHeaders(config, { contentType: 'application/json' }),
              body: JSON.stringify(body),
            });

            await parseJsonResponse(response, 'vector_store_attach', VectorStoreResponseSchema);
          },
        },
      },
    },
    debugging: {
      requests: {
        async retrieve(requestId: string) {
          const response = await fetch(`${baseUrl}/debugging/requests/${requestId}`, {
            method: 'GET',
            headers: buildHeaders(config),
          });
          return parseJsonResponse(response, 'debugging_request', DebuggingRequestResponseSchema);
        },
      },
    },
  };
}

export async function fetchOpenAIDenoDebugDetails(
  client: OpenAIDenoClient,
  requestId: string,
): Promise<unknown> {
  try {
    return await client.debugging.requests.retrieve(requestId);
  } catch (error) {
    return { debugError: error instanceof Error ? error.message : error };
  }
}
