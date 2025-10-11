import {
  fetchOpenAIDebugDetails,
  getOpenAIClient,
  isOpenAIDebugEnabled,
} from '@avocat-ai/shared';

const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });

const OPS_EMBED_CLIENT_OPTIONS = {
  cacheKeySuffix: 'ops-embedding',
  requestTags: process.env.OPENAI_REQUEST_TAGS_OPS ?? process.env.OPENAI_REQUEST_TAGS ?? 'service=ops,component=embeddings',
} as const;

export interface EmbeddingEnv {
  OPENAI_API_KEY: string;
  EMBEDDING_MODEL: string;
}

export interface Chunk {
  seq: number;
  content: string;
  marker: string | null;
}

function sanitizeText(raw: string): string {
  return raw.replace(/\p{Cc}+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function chunkText(text: string, chunkSize = 1200, overlap = 200): Chunk[] {
  const cleaned = sanitizeText(text);
  if (!cleaned) {
    return [];
  }

  const chunks: Chunk[] = [];
  let index = 0;
  let seq = 0;

  while (index < cleaned.length) {
    let end = Math.min(index + chunkSize, cleaned.length);

    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf('. ', end);
      if (lastPeriod > index + chunkSize / 2) {
        end = lastPeriod + 1;
      }
    }

    const slice = cleaned.slice(index, end).trim();
    if (slice.length > 0) {
      const markerMatch = slice.match(/\b(Article|Art\.?)[\s-]*(\d+[A-Za-z0-9-]*)/iu);
      const marker = markerMatch ? markerMatch[0].replace(/\s+/g, ' ').trim() : null;
      chunks.push({ seq, content: slice, marker });
      seq += 1;
    }

    if (end >= cleaned.length) {
      break;
    }

    index = end - overlap;
    if (index < 0 || index >= cleaned.length) {
      index = end;
    }
  }

  return chunks;
}

export async function embedTexts(inputs: string[], env: EmbeddingEnv): Promise<number[][]> {
  if (inputs.length === 0) {
    return [];
  }

  const openai = getOpenAIClient({ apiKey: env.OPENAI_API_KEY, ...OPS_EMBED_CLIENT_OPTIONS });
  let response;
  try {
    response = await openai.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: inputs,
    });
  } catch (error) {
    if (isOpenAIDebugEnabled()) {
      const info = await fetchOpenAIDebugDetails(openai, error);
      if (info) {
        console.error('[openai-debug] embedTexts', info);
      }
    }
    const message = error instanceof Error ? error.message : 'Échec de génération des embeddings';
    throw new Error(message);
  }

  return response.data
    .map((entry) => ('embedding' in entry && Array.isArray(entry.embedding) ? (entry.embedding as number[]) : null))
    .filter((vector): vector is number[] => Array.isArray(vector));
}

export async function decodeBlob(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return sanitizeText(await blob.text());
  }

  const buffer = await blob.arrayBuffer();
  return sanitizeText(decoder.decode(buffer));
}
