import type OpenAI from 'openai';

export interface VectorStoreFileParams {
  file_id: string;
}

export interface VectorStoreApi {
  retrieve(id: string): Promise<{ id: string }>;
  create(params: { name: string }): Promise<{ id: string }>;
  files: {
    create(vectorStoreId: string, params: VectorStoreFileParams): Promise<unknown>;
  };
}

function getBetaNamespace(client: OpenAI): unknown {
  return (client as OpenAI & { beta?: unknown }).beta;
}

export function getVectorStoreApi(client: OpenAI): VectorStoreApi {
  const beta = getBetaNamespace(client);
  const vectorStores = (beta as { vectorStores?: VectorStoreApi } | undefined)?.vectorStores;
  if (!vectorStores) {
    throw new Error('Vector store API is not available on this OpenAI client');
  }
  return vectorStores;
}

export function tryGetVectorStoreApi(client: OpenAI): VectorStoreApi | null {
  try {
    return getVectorStoreApi(client);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Vector store API')) {
      return null;
    }
    throw error;
  }
}
