import ora from 'ora';
import {
  fetchOpenAIDebugDetails,
  getOpenAIClient,
  isOpenAIDebugEnabled,
  tryGetVectorStoreApi,
} from '@avocat-ai/shared';

const OPS_VECTOR_CLIENT_OPTIONS = {
  cacheKeySuffix: 'ops-vector-lib',
  requestTags: process.env.OPENAI_REQUEST_TAGS_OPS ?? process.env.OPENAI_REQUEST_TAGS ?? 'service=ops,component=vector-store-lib',
} as const;

export async function validateVectorStore(apiKey: string, id: string | undefined): Promise<boolean> {
  if (!id || id.trim().length === 0) {
    return false;
  }

  if (process.env.VECTOR_STORE_DRY_RUN === '1' || process.env.OPS_CHECK_DRY_RUN === '1') {
    return true;
  }

  const openai = getOpenAIClient({ apiKey, ...OPS_VECTOR_CLIENT_OPTIONS });
  const vectorStores = tryGetVectorStoreApi(openai);

  if (vectorStores) {
    try {
      await vectorStores.retrieve(id);
      return true;
    } catch (error) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? (error as { status?: number }).status
          : undefined;

      if (status === 404) {
        return false;
      }

      if (isOpenAIDebugEnabled()) {
        const info = await fetchOpenAIDebugDetails(openai, error);
        if (info) {
          console.error('[openai-debug] validateVectorStore', info);
        }
      }

      const message = error instanceof Error ? error.message : 'OpenAI vector store validation failed';
      throw new Error(message);
    }
  }

  const response = await fetch(`https://api.openai.com/v1/vector_stores/${id}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'assistants=v2',
    },
  });

  if (response.status === 404) {
    return false;
  }

  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;

  if (!response.ok) {
    const message = payload?.error?.message ?? 'OpenAI vector store validation failed';
    throw new Error(message);
  }

  return true;
}

export async function ensureVectorStore(
  apiKey: string,
  existingId: string | undefined,
  name = 'authorities-francophone',
  spinner = ora(),
): Promise<string> {
  spinner.start('Vérification du vector store...');

  const alreadyExists = await validateVectorStore(apiKey, existingId);

  if (alreadyExists && existingId) {
    spinner.succeed(`Vector store existant détecté (${existingId}).`);
    return existingId;
  }

  const openai = getOpenAIClient({ apiKey, ...OPS_VECTOR_CLIENT_OPTIONS });
  const vectorStores = tryGetVectorStoreApi(openai);

  if (vectorStores) {
    try {
      const created = await vectorStores.create({ name });
      spinner.succeed(`Vector store créé (${created.id}).`);
      return created.id;
    } catch (error) {
      if (isOpenAIDebugEnabled()) {
        const info = await fetchOpenAIDebugDetails(openai, error);
        if (info) {
          spinner.warn('Détails du diagnostic OpenAI disponibles dans les logs.');
          console.error('[openai-debug] ensureVectorStore:create', info);
        }
      }
      const message = error instanceof Error ? error.message : 'Erreur inconnue lors de la création du vector store';
      spinner.fail(message);
      throw new Error(message);
    }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/vector_stores', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({ name }),
    });

    const payload = (await response.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null;

    if (!response.ok || !payload?.id) {
      const message = payload?.error?.message ?? 'Erreur inconnue lors de la création du vector store';
      spinner.fail(message);
      throw new Error(message);
    }

    const created = payload as { id: string };
    spinner.succeed(`Vector store créé (${created.id}).`);
    return created.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue lors de la création du vector store';
    spinner.fail(message);
    throw new Error(message);
  }
}
