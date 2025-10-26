// deno-lint-ignore-file no-explicit-any
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

async function handleResponse(response: Response, context: string): Promise<any> {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message ?? `${context}_failed`;
    throw new Error(message);
  }
  return json;
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
            : new Blob([params.data], { type: params.mimeType ?? 'application/octet-stream' });
        form.append('file', new File([blob], params.filename, { type: params.mimeType ?? blob.type }));

        const response = await fetch(`${baseUrl}/files`, {
          method: 'POST',
          headers: buildHeaders(config),
          body: form,
        });

        const json = await handleResponse(response, 'file_upload');
        return json as { id: string };
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

            await handleResponse(response, 'vector_store_attach');
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
          return handleResponse(response, 'debugging_request');
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
