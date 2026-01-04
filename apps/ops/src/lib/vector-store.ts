import ora from 'ora';

const VECTOR_STORE_ENDPOINT = 'https://api.openai.com/v1/vector_stores';

export async function validateVectorStore(apiKey: string, id: string | undefined): Promise<boolean> {
  if (!id || id.trim().length === 0) {
    return false;
  }

  if (process.env.VECTOR_STORE_DRY_RUN === '1' || process.env.OPS_CHECK_DRY_RUN === '1') {
    return true;
  }

  const response = await fetch(`${VECTOR_STORE_ENDPOINT}/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (response.ok) {
    return true;
  }

  const payload = await response
    .json()
    .catch(() => ({ error: { message: `OpenAI API error ${response.status}` } }));

  if (response.status === 404) {
    return false;
  }

  const message = payload?.error?.message ?? `OpenAI API error ${response.status}`;
  throw new Error(message);
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

  const creation = await fetch(VECTOR_STORE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  const json = await creation.json();

  if (!creation.ok) {
    const message = json?.error?.message ?? 'Erreur inconnue lors de la création du vector store';
    spinner.fail(message);
    throw new Error(message);
  }

  spinner.succeed(`Vector store créé (${json.id as string}).`);
  return json.id as string;
}
